import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { dirname, isAbsolute, normalize } from "pathe";
import type { Nitro } from "nitro/types";
import { ensureDep, isDepInstalled } from "../../utils/dep.ts";
import { type JSONSchema, typeToJSONSchema } from "./_type-schema.ts";

interface TypeScriptEngine {
  infer(file: string): JSONSchema | undefined;
  invalidate(file: string): void;
  close(): void;
}

export function createRouteResponseSchemaGenerator(nitro: Nitro) {
  const files = [
    ...new Set(
      Object.values(nitro.routing.routes.routes)
        .flatMap((route) => route.data)
        .map((handler) => normalize(handler.handler))
        .filter((handler) => isAbsolute(handler) && /\.[cm]?[jt]sx?$/.test(handler))
    ),
  ];
  let enginePromise: Promise<TypeScriptEngine | undefined> | undefined;

  return {
    async infer(file: string) {
      if (nitro.options.openAPI?.inferResponseSchemas === false) {
        return;
      }
      enginePromise ||= createTypeScriptEngine(nitro, { files });
      try {
        return (await enginePromise)?.infer(normalize(file));
      } catch (error) {
        nitro.logger.debug(`[openapi] Cannot infer response schema for ${file}: ${error}`);
      }
    },
    invalidate(file: string) {
      void enginePromise?.then((engine) => engine?.invalidate(normalize(file)));
    },
    close() {
      void enginePromise?.then((engine) => engine?.close());
    },
  };
}

async function createTypeScriptEngine(
  nitro: Nitro,
  options: { files: string[] }
): Promise<TypeScriptEngine | undefined> {
  const { files } = options;
  const typescriptEntry = isDepInstalled("typescript", { dir: nitro.options.rootDir })
    ? await ensureDep({
        id: "typescript",
        dir: nitro.options.rootDir,
        reason: "inferring OpenAPI response schemas",
      })
    : undefined;
  if (!typescriptEntry) {
    warnMissingTypeScript(nitro);
    return;
  }
  const nativeEntry = resolveModulePath("typescript/unstable/sync", {
    from: [typescriptEntry, nitro.options.rootDir],
    try: true,
  });
  if (nativeEntry) {
    const ts = await import(pathToFileURL(nativeEntry).href);
    return createNativeEngine(ts, { rootDir: nitro.options.rootDir, files });
  }

  const mod = await import(pathToFileURL(typescriptEntry).href);
  const ts = mod.default?.createProgram ? mod.default : mod;
  if (ts.createProgram) {
    return createClassicEngine(ts, { rootDir: nitro.options.rootDir, files });
  }
}

function warnMissingTypeScript(nitro: Nitro) {
  nitro.logger.warn(
    '[openapi] Cannot infer response schemas because "typescript" is not installed. Install it as a dev dependency or define openAPI.responses manually.'
  );
}

function createNativeEngine(
  ts: any,
  options: { rootDir: string; files: string[] }
): TypeScriptEngine {
  const { rootDir, files } = options;
  const api = new ts.API({ cwd: rootDir });
  let snapshot = api.updateSnapshot({ openFiles: files });
  const dirty = new Set<string>();
  const opened = new Set(files);

  return {
    infer(file) {
      if (dirty.size > 0) {
        const reopen = [...dirty].filter((file) => opened.has(file));
        if (reopen.length > 0) {
          update({ closeFiles: reopen });
        }
        update({ openFiles: reopen, fileChanges: { changed: [...dirty] } });
        dirty.clear();
      }
      let project = snapshot.getProjects().find((item: any) => item.program.getSourceFile(file));
      if (!project) {
        update({ openFiles: [file] });
        opened.add(file);
        project = snapshot.getDefaultProjectForFile(file);
      }
      return (
        project &&
        inferFromProgram(file, { ts, program: project.program, checker: project.checker })
      );
    },
    invalidate(file) {
      dirty.add(file);
    },
    close() {
      snapshot.dispose();
      api.close();
    },
  };

  function update(options: Record<string, unknown>) {
    const previous = snapshot;
    snapshot = api.updateSnapshot(options);
    previous.dispose();
  }
}

function createClassicEngine(
  ts: any,
  config: { rootDir: string; files: string[] }
): TypeScriptEngine {
  const { rootDir, files } = config;
  const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");
  let rootNames = files;
  let options: Record<string, unknown> = {
    allowJs: true,
    checkJs: false,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
  };
  if (configPath) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      dirname(configPath),
      {},
      configPath
    );
    rootNames = [...new Set([...parsed.fileNames, ...files])];
    options = { ...parsed.options, noEmit: true };
  }

  let program = ts.createProgram({ rootNames, options });
  let dirty = false;
  return {
    infer(file) {
      if (!rootNames.includes(file)) {
        rootNames = [...rootNames, file];
        dirty = true;
      }
      if (dirty) {
        program = ts.createProgram({ rootNames, options, oldProgram: program });
        dirty = false;
      }
      return inferFromProgram(file, { ts, program, checker: program.getTypeChecker() });
    },
    invalidate() {
      dirty = true;
    },
    close() {},
  };
}

function inferFromProgram(file: string, options: { ts: any; program: any; checker: any }) {
  const { ts, program, checker } = options;
  const sourceFile = program.getSourceFile(file);
  const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
  const defaultExport =
    moduleSymbol &&
    checker.getExportsOfModule(moduleSymbol).find((symbol: any) => symbol.name === "default");
  if (!sourceFile || !defaultExport) {
    return;
  }

  const handlerType = checker.getTypeOfSymbolAtLocation(defaultExport, sourceFile);
  const signature = checker.getSignaturesOfType(handlerType, ts.SignatureKind.Call)[0];
  const returnType = signature && checker.getReturnTypeOfSignature(signature);
  return typeToJSONSchema(returnType, {
    checker,
    sourceFile,
    signatureKind: ts.SignatureKind.Call,
    symbolFlags: ts.SymbolFlags,
    typeFlags: ts.TypeFlags,
  });
}
