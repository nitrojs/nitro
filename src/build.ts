import { promises as fsp } from "node:fs";
import { relative, resolve, join, dirname, isAbsolute } from "pathe";
import { resolveAlias } from "pathe/utils";
import * as rollup from "rollup";
import fse from "fs-extra";
import { defu } from "defu";
import { watch } from "chokidar";
import { genTypeImport } from "knitwork";
import { debounce } from "perfect-debounce";
import type { TSConfig } from "pkg-types";
import type { RollupError } from "rollup";
import type { OnResolveResult, PartialMessage } from "esbuild";
import type { RouterMethod } from "h3";
import { generateFSTree } from "./utils/tree";
import { getRollupConfig, RollupConfig } from "./rollup/config";
import { prettyPath, writeFile, isDirectory } from "./utils";
import { GLOB_SCAN_PATTERN, scanHandlers } from "./scan";
import type { Nitro } from "./types";
import { runtimeDir } from "./dirs";
import { snapshotStorage } from "./storage";
import { compressPublicAssets } from "./compress";

export async function prepare(nitro: Nitro) {
  await prepareDir(nitro.options.output.dir);
  if (!nitro.options.noPublicDir) {
    await prepareDir(nitro.options.output.publicDir);
  }
  if (nitro.options.build) {
    await prepareDir(nitro.options.output.serverDir);
  }
}

async function prepareDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
  await fse.emptyDir(dir);
}

export async function copyPublicAssets(nitro: Nitro) {
  if (nitro.options.noPublicDir) {
    return;
  }
  for (const asset of nitro.options.publicAssets) {
    if (await isDirectory(asset.dir)) {
      await fse.copy(
        asset.dir,
        join(nitro.options.output.publicDir, asset.baseURL!),
        { overwrite: false }
      );
    }
  }
  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }
  nitro.logger.success(
    "Generated public " + prettyPath(nitro.options.output.publicDir)
  );
}

export async function build(nitro: Nitro) {
  const rollupConfig = getRollupConfig(nitro);
  await nitro.hooks.callHook("rollup:before", nitro);
  return nitro.options.dev
    ? _watch(nitro, rollupConfig)
    : _build(nitro, rollupConfig);
}

export async function writeTypes(nitro: Nitro) {
  const routeTypes: Record<
    string,
    Partial<Record<RouterMethod | "default", string[]>>
  > = {};

  const typesDir = dirname(
    resolve(nitro.options.buildDir, nitro.options.typescript.tsconfigPath)
  );

  const middleware = [...nitro.scannedHandlers, ...nitro.options.handlers];

  for (const mw of middleware) {
    if (typeof mw.handler !== "string" || !mw.route) {
      continue;
    }
    const relativePath = relative(typesDir, mw.handler).replace(
      /\.[a-z]+$/,
      ""
    );

    if (!routeTypes[mw.route]) {
      routeTypes[mw.route] = {};
    }

    const method = mw.method || "default";
    if (!routeTypes[mw.route][method]) {
      routeTypes[mw.route][method] = [];
    }
    routeTypes[mw.route][method].push(
      `Simplify<Serialize<Awaited<ReturnType<typeof import('${relativePath}').default>>>>`
    );
  }

  let autoImportedTypes: string[] = [];

  if (nitro.unimport) {
    await nitro.unimport.init();
    autoImportedTypes = [
      (
        await nitro.unimport.generateTypeDeclarations({
          exportHelper: false,
          resolvePath: (i) => {
            if (i.from.startsWith("#internal/nitro")) {
              return resolveAlias(i.from, nitro.options.alias);
            }
            return i.from;
          },
        })
      ).trim(),
    ];
  }

  const routes = [
    "// Generated by nitro",
    "import type { Serialize, Simplify } from 'nitropack'",
    "declare module 'nitropack' {",
    "  type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T",
    "  interface InternalApi {",
    ...Object.entries(routeTypes).map(([path, methods]) =>
      [
        `    '${path}': {`,
        ...Object.entries(methods).map(
          ([method, types]) => `      '${method}': ${types.join(" | ")}`
        ),
        "    }",
      ].join("\n")
    ),
    "  }",
    "}",
    // Makes this a module for augmentation purposes
    "export {}",
  ];

  const config = [
    "// Generated by nitro",
    `
// App Config
import type { Defu } from 'defu'

${nitro.options.appConfigFiles
  .map((file, index) =>
    genTypeImport(file.replace(/\.\w+$/, ""), [
      { name: "default", as: `appConfig${index}` },
    ])
  )
  .join("\n")}

type UserAppConfig = Defu<{}, [${nitro.options.appConfigFiles
      .map((_, index: number) => `typeof appConfig${index}`)
      .join(", ")}]>

declare module 'nitropack' {
  interface AppConfig extends UserAppConfig {}
}
    `,
    // Makes this a module for augmentation purposes
    "export {}",
  ];

  const declarations = [
    // local nitropack augmentations
    '/// <reference path="./nitro-routes.d.ts" />',
    '/// <reference path="./nitro-config.d.ts" />',
    // global server auto-imports
    '/// <reference path="./nitro-imports.d.ts" />',
  ];

  await writeFile(
    join(nitro.options.buildDir, "types/nitro-routes.d.ts"),
    routes.join("\n")
  );

  await writeFile(
    join(nitro.options.buildDir, "types/nitro-config.d.ts"),
    config.join("\n")
  );

  await writeFile(
    join(nitro.options.buildDir, "types/nitro-imports.d.ts"),
    [...autoImportedTypes, "export {}"].join("\n")
  );

  await writeFile(
    join(nitro.options.buildDir, "types/nitro.d.ts"),
    declarations.join("\n")
  );

  if (nitro.options.typescript.generateTsConfig) {
    const tsConfig: TSConfig = {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Node",
        allowJs: true,
        resolveJsonModule: true,
        paths: nitro.options.typescript.internalPaths
          ? {
              "#internal/nitro": [join(runtimeDir, "index")],
              "#internal/nitro/*": [join(runtimeDir, "*")],
            }
          : {},
      },
      include: [
        relative(
          typesDir,
          join(nitro.options.buildDir, "types/nitro.d.ts")
        ).replace(/^(?=[^.])/, "./"),
        join(relative(typesDir, nitro.options.rootDir), "**/*"),
        ...(nitro.options.srcDir !== nitro.options.rootDir
          ? [join(relative(typesDir, nitro.options.srcDir), "**/*")]
          : []),
      ],
    };
    await writeFile(
      resolve(nitro.options.buildDir, nitro.options.typescript.tsconfigPath),
      JSON.stringify(tsConfig, null, 2)
    );
  }
}

async function _snapshot(nitro: Nitro) {
  if (
    nitro.options.bundledStorage.length === 0 ||
    nitro.options.preset === "nitro-prerender"
  ) {
    return;
  }
  // TODO: Use virtual storage for server assets
  const storageDir = resolve(nitro.options.buildDir, "snapshot");
  nitro.options.serverAssets.push({
    baseName: "nitro:bundled",
    dir: storageDir,
  });

  const data = await snapshotStorage(nitro);
  await Promise.all(
    Object.entries(data).map(async ([path, contents]) => {
      if (typeof contents !== "string") {
        contents = JSON.stringify(contents);
      }
      const fsPath = join(storageDir, path.replace(/:/g, "/"));
      await fsp.mkdir(dirname(fsPath), { recursive: true });
      await fsp.writeFile(fsPath, contents, "utf8");
    })
  );
}

async function _build(nitro: Nitro, rollupConfig: RollupConfig) {
  await scanHandlers(nitro);
  await writeTypes(nitro);
  await _snapshot(nitro);

  if (nitro.options.build) {
    nitro.logger.info(
      `Building Nitro Server (preset: \`${nitro.options.preset}\`)`
    );
    const build = await rollup.rollup(rollupConfig).catch((error) => {
      nitro.logger.error(formatRollupError(error));
      throw error;
    });

    await build.write(rollupConfig.output);
  }

  // Write build info
  const nitroConfigPath = resolve(nitro.options.output.dir, "nitro.json");
  const buildInfo = {
    date: new Date(),
    preset: nitro.options.preset,
    commands: {
      preview: nitro.options.commands.preview,
      deploy: nitro.options.commands.deploy,
    },
  };
  await writeFile(nitroConfigPath, JSON.stringify(buildInfo, null, 2));

  if (nitro.options.build) {
    nitro.logger.success("Nitro server built");
    if (nitro.options.logLevel > 1) {
      process.stdout.write(
        await generateFSTree(nitro.options.output.serverDir)
      );
    }
    await nitro.hooks.callHook("compiled", nitro);
  }

  // Show deploy and preview hints
  const rOutput = relative(process.cwd(), nitro.options.output.dir);
  const rewriteRelativePaths = (input: string) => {
    return input.replace(/\s\.\/(\S*)/g, ` ${rOutput}/$1`);
  };
  if (buildInfo.commands.preview) {
    nitro.logger.success(
      `You can preview this build using \`${rewriteRelativePaths(
        buildInfo.commands.preview
      )}\``
    );
  }
  if (buildInfo.commands.deploy) {
    nitro.logger.success(
      `You can deploy this build using \`${rewriteRelativePaths(
        buildInfo.commands.deploy
      )}\``
    );
  }
}

function startRollupWatcher(nitro: Nitro, rollupConfig: RollupConfig) {
  const watcher = rollup.watch(
    defu(rollupConfig, {
      watch: {
        chokidar: nitro.options.watchOptions,
      },
    })
  );
  let start: number;

  watcher.on("event", (event) => {
    switch (event.code) {
      // The watcher is (re)starting
      case "START":
        return;

      // Building an individual bundle
      case "BUNDLE_START":
        start = Date.now();
        return;

      // Finished building all bundles
      case "END":
        nitro.hooks.callHook("compiled", nitro);
        nitro.logger.success(
          "Nitro built",
          start ? `in ${Date.now() - start} ms` : ""
        );
        nitro.hooks.callHook("dev:reload");
        return;

      // Encountered an error while bundling
      case "ERROR":
        nitro.logger.error(formatRollupError(event.error));
    }
  });
  return watcher;
}

async function _watch(nitro: Nitro, rollupConfig: RollupConfig) {
  let rollupWatcher: rollup.RollupWatcher;

  const reload = debounce(async () => {
    if (rollupWatcher) {
      await rollupWatcher.close();
    }
    await scanHandlers(nitro);
    rollupWatcher = startRollupWatcher(nitro, rollupConfig);
    await writeTypes(nitro);
  });

  const watchPatterns = nitro.options.scanDirs.flatMap((dir) => [
    join(dir, "api"),
    join(dir, "routes"),
    join(dir, "middleware", GLOB_SCAN_PATTERN),
  ]);

  const watchReloadEvents = new Set(["add", "addDir", "unlink", "unlinkDir"]);
  const reloadWacher = watch(watchPatterns, { ignoreInitial: true }).on(
    "all",
    (event) => {
      if (watchReloadEvents.has(event)) {
        reload();
      }
    }
  );

  nitro.hooks.hook("close", () => {
    rollupWatcher.close();
    reloadWacher.close();
  });

  await reload();
}

function formatRollupError(_error: RollupError | OnResolveResult) {
  try {
    const logs: string[] = [_error.toString()];
    for (const error of "errors" in _error
      ? _error.errors
      : [_error as RollupError]) {
      const id = (error as any).path || error.id || (_error as RollupError).id;
      let path = isAbsolute(id) ? relative(process.cwd(), id) : id;
      const location =
        (error as RollupError).loc || (error as PartialMessage).location;
      if (location) {
        path += `:${location.line}:${location.column}`;
      }
      const text =
        (error as PartialMessage).text || (error as RollupError).frame;
      logs.push(
        `Rollup error while processing \`${path}\`` + text ? "\n\n" + text : ""
      );
    }
    return logs.join("\n");
  } catch {
    return _error?.toString();
  }
}
