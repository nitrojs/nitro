import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { dirname, isAbsolute } from "pathe";
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
        .map((handler) => handler.handler)
        .filter((handler) => isAbsolute(handler) && /\.[cm]?[jt]sx?$/.test(handler))
    ),
  ];
  let enginePromise: Promise<TypeScriptEngine | undefined> | undefined;

  return {
    async infer(file: string) {
      enginePromise ||= createTypeScriptEngine(nitro, files);
      try {
        return (await enginePromise)?.infer(file);
      } catch (error) {
        nitro.logger.debug(`[openapi] Cannot infer response schema for ${file}: ${error}`);
      }
    },
    invalidate(file: string) {
      void enginePromise?.then((engine) => engine?.invalidate(file));
    },
    close() {
      void enginePromise?.then((engine) => engine?.close());
    },
  };
}

async function createTypeScriptEngine(
  nitro: Nitro,
  files: string[]
): Promise<TypeScriptEngine | undefined> {
  if (!isDepInstalled("typescript", nitro.options.rootDir)) {
    warnMissingTypeScript(nitro);
    return;
  }
  const typescriptEntry = await ensureDep({
    id: "typescript",
    dir: nitro.options.rootDir,
    reason: "inferring OpenAPI response schemas",
  });
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
    return createNativeEngine(ts, nitro.options.rootDir, files);
  }

  const mod = await import(pathToFileURL(typescriptEntry).href);
  const ts = mod.default?.createProgram ? mod.default : mod;
  if (ts.createProgram) {
    return createClassicEngine(ts, nitro.options.rootDir, files);
  }
}

function warnMissingTypeScript(nitro: Nitro) {
  nitro.logger.warn(
    '[openapi] Cannot infer response schemas because "typescript" is not installed. Install it as a dev dependency or define openAPI.responses manually.'
  );
}

function createNativeEngine(ts: any, rootDir: string, files: string[]): TypeScriptEngine {
  const api = new ts.API({ cwd: rootDir });
  let snapshot = api.updateSnapshot({ openFiles: files });
  const dirty = new Set<string>();

  return {
    infer(file) {
      if (dirty.size > 0) {
        const previous = snapshot;
        snapshot = api.updateSnapshot({ fileChanges: { changed: [...dirty] } });
        dirty.clear();
        previous.dispose();
      }
      let project = snapshot.getProjects().find((item: any) => item.program.getSourceFile(file));
      if (!project) {
        const previous = snapshot;
        snapshot = api.updateSnapshot({ openFiles: [file] });
        previous.dispose();
        project = snapshot.getDefaultProjectForFile(file);
      }
      return project && inferFromProgram(ts, project.program, project.checker, file);
    },
    invalidate(file) {
      dirty.add(file);
    },
    close() {
      snapshot.dispose();
      api.close();
    },
  };
}

function createClassicEngine(ts: any, rootDir: string, files: string[]): TypeScriptEngine {
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
      if (dirty) {
        program = ts.createProgram({ rootNames, options, oldProgram: program });
        dirty = false;
      }
      return inferFromProgram(ts, program, program.getTypeChecker(), file);
    },
    invalidate() {
      dirty = true;
    },
    close() {},
  };
}

function inferFromProgram(ts: any, program: any, checker: any, file: string) {
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
