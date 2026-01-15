import { existsSync, promises as fsp } from "node:fs";
import { defu } from "defu";
import { lookupNodeModuleSubpath, parseNodeModulePath } from "mlly";
import { resolveModulePath } from "exsolve";
import { isDirectory, resolveNitroPath, writeFile } from "../utils/fs.ts";
import { runtimeDir } from "nitro/meta";
import type { Nitro, NitroTypes } from "nitro/types";
import { dirname, isAbsolute, join, resolve } from "pathe";
import { relative } from "pathe";
import { resolveAlias } from "pathe/utils";
import type { TSConfig } from "pkg-types";
import type { JSValue } from "untyped";
import { generateTypes, resolveSchema } from "untyped";
import { toExports } from "unimport";

export async function writeTypes(nitro: Nitro) {
  const types: NitroTypes = {
    routes: {},
  };

  const generatedTypesDir = resolve(
    nitro.options.rootDir,
    nitro.options.typescript.generatedTypesDir || "node_modules/.nitro/types"
  );

  const middleware = [...nitro.scannedHandlers, ...nitro.options.handlers];

  for (const mw of middleware) {
    if (typeof mw.handler !== "string" || !mw.route) {
      continue;
    }
    const relativePath = relative(
      generatedTypesDir,
      resolveNitroPath(mw.handler, nitro.options)
    ).replace(/\.(js|mjs|cjs|ts|mts|cts|tsx|jsx)$/, "");

    const method = mw.method || "default";

    types.routes[mw.route] ??= {};
    types.routes[mw.route][method] ??= [];
    types.routes[mw.route][method]!.push(
      `Simplify<Serialize<Awaited<ReturnType<typeof import('${relativePath}').default>>>>`
    );
  }

  let autoImportedTypes: string[] = [];
  let autoImportExports = "";

  if (nitro.unimport) {
    await nitro.unimport.init();

    // TODO: fully resolve utils exported from `#imports`

    const allImports = await nitro.unimport.getImports();

    autoImportExports = toExports(allImports).replace(
      /#internal\/nitro/g,
      relative(generatedTypesDir, runtimeDir)
    );

    const resolvedImportPathMap = new Map<string, string>();

    for (const i of allImports) {
      const from = i.typeFrom || i.from;
      if (resolvedImportPathMap.has(from)) {
        continue;
      }
      let path = resolveAlias(from, nitro.options.alias);
      if (!isAbsolute(path)) {
        const resolvedPath = resolveModulePath(from, {
          try: true,
          from: nitro.options.rootDir,
          conditions: ["type", "node", "import"],
          suffixes: ["", "/index"],
          extensions: [".mjs", ".cjs", ".js", ".mts", ".cts", ".ts"],
        });
        if (resolvedPath) {
          const { dir, name } = parseNodeModulePath(resolvedPath);
          if (!dir || !name) {
            path = resolvedPath;
          } else {
            const subpath = await lookupNodeModuleSubpath(resolvedPath);
            path = join(dir, name, subpath || "");
          }
        }
      }
      if (existsSync(path) && !(await isDirectory(path))) {
        path = path.replace(/\.[a-z]+$/, "");
      }
      if (isAbsolute(path)) {
        path = relative(generatedTypesDir, path);
      }
      resolvedImportPathMap.set(from, path);
    }

    autoImportedTypes = [
      nitro.options.imports && nitro.options.imports.autoImport !== false
        ? (
            await nitro.unimport.generateTypeDeclarations({
              exportHelper: false,
              resolvePath: (i) => {
                const from = i.typeFrom || i.from;
                return resolvedImportPathMap.get(from) ?? from;
              },
            })
          ).trim()
        : "",
    ];
  }

  const buildRouteTree = () => {
    type RouteNode = {
      $?: Record<string, string[]>;
      [segment: string]: RouteNode | Record<string, string[]> | undefined;
    };

    const tree: RouteNode = {};

    for (const [path, methods] of Object.entries(types.routes)) {
      const segments = path === "/" ? [] : path.slice(1).split("/");
      let node = tree;

      for (const segment of segments) {
        node[segment] ??= {};
        node = node[segment] as RouteNode;
      }

      node.$ ??= {};

      for (const [method, typeEntries] of Object.entries(methods)) {
        node.$[method] = [...(node.$[method] ?? []), ...typeEntries];
      }
    }

    return tree;
  };

  const renderRouteTree = (
    node: ReturnType<typeof buildRouteTree>,
    level: number
  ): string[] => {
    const lines: string[] = [];
    const indent = "  ".repeat(level);
    const childIndent = "  ".repeat(level + 1);

    if (node.$) {
      lines.push(`${indent}'$': {`);
      for (const [method, types] of Object.entries(node.$)) {
        lines.push(`${childIndent}'${method}': ${types.join(" | ")}`);
      }
      lines.push(`${indent}}`);
    }

    for (const [segment, child] of Object.entries(node)) {
      if (segment === "$" || !child || typeof child !== "object") {
        continue;
      }
      lines.push(`${indent}'${segment}': {`);
      lines.push(
        ...renderRouteTree(
          child as ReturnType<typeof buildRouteTree>,
          level + 1
        )
      );
      lines.push(`${indent}}`);
    }

    return lines;
  };

  const generateRoutes = () => {
    const routeTree = buildRouteTree();
    return [
      "// Generated by nitro",
      'import type { Serialize, Simplify } from "nitro/types";',
      'declare module "nitro/types" {',
      "  type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T",
      "  interface InternalApi {",
      ...renderRouteTree(routeTree, 2),
      "  }",
      "}",
      // Makes this a module for augmentation purposes
      "export {}",
    ];
  };

  const config = [
    "// Generated by nitro",
    /* ts */ `declare module "nitro/types" {`,
    nitro.options.typescript.generateRuntimeConfigTypes
      ? generateTypes(
          await resolveSchema(
            Object.fromEntries(
              Object.entries(nitro.options.runtimeConfig).filter(
                ([key]) => !["app", "nitro"].includes(key)
              )
            ) as Record<string, JSValue>
          ),
          {
            interfaceName: "NitroRuntimeConfig",
            addExport: false,
            addDefaults: false,
            allowExtraKeys: false,
            indentation: 2,
          }
        )
      : "",
    `}`,
    // Makes this a module for augmentation purposes
    "export {}",
  ];

  const declarations = [
    // local nitro augmentations
    '/// <reference path="./nitro-routes.d.ts" />',
    '/// <reference path="./nitro-config.d.ts" />',
    // global server auto-imports
    '/// <reference path="./nitro-imports.d.ts" />',
  ];

  const buildFiles: { path: string; contents: string | (() => string) }[] = [];

  buildFiles.push({
    path: join(generatedTypesDir, "nitro-routes.d.ts"),
    contents: () => generateRoutes().join("\n"),
  });

  buildFiles.push({
    path: join(generatedTypesDir, "nitro-config.d.ts"),
    contents: config.join("\n"),
  });

  buildFiles.push({
    path: join(generatedTypesDir, "nitro-imports.d.ts"),
    contents: [...autoImportedTypes, autoImportExports || "export {}"].join(
      "\n"
    ),
  });

  buildFiles.push({
    path: join(generatedTypesDir, "nitro.d.ts"),
    contents: declarations.join("\n"),
  });

  if (nitro.options.typescript.generateTsConfig) {
    const tsConfigPath = resolve(
      generatedTypesDir,
      nitro.options.typescript.tsconfigPath || "tsconfig.json"
    );
    const tsconfigDir = dirname(tsConfigPath);
    const tsConfig: TSConfig = defu(nitro.options.typescript.tsConfig, {
      compilerOptions: {
        /* Base options: */
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        target: "ESNext",
        allowJs: true,
        resolveJsonModule: true,
        moduleDetection: "force",
        isolatedModules: true,
        verbatimModuleSyntax: true,
        allowImportingTsExtensions: true,
        /* Strictness */
        strict: nitro.options.typescript.strict,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        forceConsistentCasingInFileNames: true,
        /* If NOT transpiling with TypeScript: */
        module: "Preserve",
        jsx: "preserve",
        jsxFactory: "h",
        jsxFragmentFactory: "Fragment",
        paths: {
          "#imports": [
            relativeWithDot(
              tsconfigDir,
              join(generatedTypesDir, "nitro-imports")
            ),
          ],
        },
      },
      include: [
        relativeWithDot(
          tsconfigDir,
          join(generatedTypesDir, "nitro.d.ts")
        ).replace(/^(?=[^.])/, "./"),
        join(relativeWithDot(tsconfigDir, nitro.options.rootDir), "**/*"),
        ...(!nitro.options.serverDir ||
        nitro.options.serverDir === nitro.options.rootDir
          ? []
          : [
              join(
                relativeWithDot(tsconfigDir, nitro.options.serverDir),
                "**/*"
              ),
            ]),
      ],
    });

    for (const alias in tsConfig.compilerOptions!.paths) {
      const paths = await Promise.all(
        tsConfig.compilerOptions!.paths[alias].map(async (path: string) => {
          if (!isAbsolute(path)) {
            return path;
          }
          const stats = await fsp
            .stat(path)
            .catch(() => null /* file does not exist */);
          return relativeWithDot(
            tsconfigDir,
            stats?.isFile()
              ? path.replace(/(?<=\w)\.\w+$/g, "") /* remove extension */
              : path
          );
        })
      );
      tsConfig.compilerOptions!.paths[alias] = [...new Set(paths)];
    }

    tsConfig.include = [
      ...new Set(
        tsConfig.include!.map((p) =>
          isAbsolute(p) ? relativeWithDot(tsconfigDir, p) : p
        )
      ),
    ];
    if (tsConfig.exclude) {
      tsConfig.exclude = [
        ...new Set(
          tsConfig.exclude!.map((p) =>
            isAbsolute(p) ? relativeWithDot(tsconfigDir, p) : p
          )
        ),
      ];
    }

    types.tsConfig = tsConfig;

    buildFiles.push({
      path: tsConfigPath,
      contents: () => JSON.stringify(tsConfig, null, 2),
    });
  }

  await nitro.hooks.callHook("types:extend", types);

  await Promise.all(
    buildFiles.map(async (file) => {
      await writeFile(
        resolve(generatedTypesDir, file.path),
        typeof file.contents === "string" ? file.contents : file.contents()
      );
    })
  );
}

const RELATIVE_RE = /^\.{1,2}\//;

export function relativeWithDot(from: string, to: string) {
  const rel = relative(from, to);
  return RELATIVE_RE.test(rel) ? rel : "./" + rel;
}
