import type {
  ConfigEnv,
  EnvironmentOptions,
  UserConfig,
  PluginOption as VitePlugin,
} from "vite";
import type { InputOption } from "rollup";
import type { NitroPluginConfig, NitroPluginContext } from "./types";
import { resolve, relative, join } from "pathe";
import { createNitro, prepare } from "../..";
import { getViteRollupConfig } from "./rollup";
import { buildEnvironments, prodSetup } from "./prod";
import {
  createDevWorker,
  createNitroEnvironment,
  createServiceEnvironments,
} from "./env";
import { configureViteDevServer } from "./dev";
import { runtimeDependencies, runtimeDir } from "nitro/runtime/meta";
import { resolveModulePath } from "exsolve";
import { defu } from "defu";
import { prettyPath } from "../../utils/fs";
import { NitroDevApp } from "../../dev/app";
import { nitroPreviewPlugin } from "./preview";
import { assetsPlugin } from "@hiogawa/vite-plugin-fullstack";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

const DEFAULT_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"];

const debug = process.env.NITRO_DEBUG
  ? (...args: any[]) => console.log("[nitro]", ...args)
  : () => {};

export function nitro(pluginConfig: NitroPluginConfig = {}): VitePlugin {
  const ctx: NitroPluginContext = createContext(pluginConfig);
  return [
    nitroInit(ctx),
    nitroEnv(ctx),
    nitroMain(ctx),
    nitroPrepare(ctx),
    nitroService(ctx),
    nitroPreviewPlugin(ctx),
    pluginConfig.experimental?.assetsImport !== false &&
      assetsPlugin({
        experimental: {
          // See https://github.com/hi-ogawa/vite-plugins/pull/1289
          clientBuildFallback: false,
        },
      }),
  ];
}

function nitroInit(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:init",
    sharedDuringBuild: true,
    apply: (_config, configEnv) => !configEnv.isPreview,

    async config(config, configEnv) {
      if (!ctx._initialized) {
        debug("[init] Initializing nitro");
        ctx._initialized = true;
        await setupNitroContext(ctx, configEnv, config);
      }
    },

    applyToEnvironment(env) {
      if (env.name === "nitro" && ctx.nitro?.options.dev) {
        debug("[init] Adding rollup plugins for dev");
        return [...((ctx.rollupConfig?.config.plugins as VitePlugin[]) || [])];
      }
    },
  };
}

function nitroEnv(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:env",
    sharedDuringBuild: true,
    apply: (_config, configEnv) => !configEnv.isPreview,

    async config(userConfig, _configEnv) {
      debug("[env]  Extending config (environments)");
      const environments: Record<string, EnvironmentOptions> = {
        ...createServiceEnvironments(ctx),
        nitro: createNitroEnvironment(ctx),
      };
      environments.client = {
        consumer: userConfig.environments?.client?.consumer ?? "client",
        build: {
          rollupOptions: {
            input:
              userConfig.environments?.client?.build?.rollupOptions?.input ??
              useNitro(ctx).options.renderer?.template,
          },
        },
      };
      debug("[env]  Environments:", Object.keys(environments).join(", "));
      return {
        environments,
      };
    },

    configEnvironment(name, config) {
      if (config.consumer === "client") {
        debug(
          "[env]  Configuring client environment",
          name === "client" ? "" : ` (${name})`
        );
        config.build!.emptyOutDir = false;
        config.build!.outDir = useNitro(ctx).options.output.publicDir;
      } else {
        if (
          ctx.pluginConfig.experimental?.virtualBundle &&
          name in (ctx.pluginConfig.services || {})
        ) {
          debug("[env]  Configuring service environment for virtual:", name);
          config.build ??= {};
          config.build.write = config.build.write ?? false;
        }
      }
    },
  };
}

function nitroMain(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:main",
    sharedDuringBuild: true,
    apply: (_config, configEnv) => !configEnv.isPreview,

    async config(userConfig, _configEnv) {
      debug("[main] Extending config (appType, resolve, server)");
      if (!ctx.rollupConfig) {
        throw new Error("Nitro rollup config is not initialized yet.");
      }
      return {
        appType: userConfig.appType || "custom",
        resolve: {
          // TODO: environment specific aliases not working
          // https://github.com/vitejs/vite/pull/17583 (seems not effective)
          alias: ctx.rollupConfig.base.aliases,
        },
        builder: {
          sharedConfigBuild: true,
        },
        server: {
          port:
            Number.parseInt(process.env.PORT || "") ||
            userConfig.server?.port ||
            useNitro(ctx).options.devServer?.port ||
            3000,
          // #3673, disable Vite's `cors` by default as Nitro handles all requests
          cors: false,
        },
      };
    },

    configResolved(config) {
      if (config.command === "build") {
        debug("[main] Inferring caching routes");
        // Add cache-control to immutable client assets
        for (const env of Object.values(config.environments)) {
          if (env.consumer === "client") {
            const rule = (ctx.nitro!.options.routeRules[
              `/${env.build.assetsDir}/**`
            ] ??= {});
            if (!rule.headers?.["cache-control"]) {
              rule.headers = {
                ...rule.headers,
                "cache-control": `public, max-age=31536000, immutable`,
              };
            }
          }
        }
      }

      // Refresh nitro routes
      debug("[main] Syncing nitro routes");
      ctx.nitro!.routing.sync();
    },

    buildApp: {
      order: "post",
      handler(builder) {
        debug("[main] Building environments");
        return buildEnvironments(ctx, builder);
      },
    },

    generateBundle: {
      handler(_options, bundle) {
        const environment = this.environment;
        debug(
          "[main] Generating manifest and entry points for environment:",
          environment.name
        );
        const { root } = environment.config;
        const services = ctx.pluginConfig.services || {};
        const serviceNames = Object.keys(services);
        const isRegisteredService = serviceNames.includes(environment.name);

        // Find entry point of this service
        let entryFile: string | undefined;
        for (const [_name, file] of Object.entries(bundle)) {
          if (file.type === "chunk") {
            if (isRegisteredService && file.isEntry) {
              if (entryFile === undefined) {
                entryFile = file.fileName;
              } else {
                this.warn(
                  `Multiple entry points found for service "${environment.name}"`
                );
              }
            }
            const filteredModuleIds = file.moduleIds.filter((id) =>
              id.startsWith(root)
            );
            for (const id of filteredModuleIds) {
              const originalFile = relative(root, id);
              ctx._manifest[originalFile] = { file: file.fileName };
            }
          }
        }
        if (isRegisteredService) {
          if (entryFile === undefined) {
            this.error(
              `No entry point found for service "${this.environment.name}".`
            );
          }
          ctx._entryPoints![this.environment.name] = entryFile!;
          ctx._serviceBundles[this.environment.name] = bundle;
        }
      },
    },

    configureServer: (server) => {
      debug("[main] Configuring dev server");
      return configureViteDevServer(ctx, server);
    },
  };
}

function nitroPrepare(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:prepare",
    sharedDuringBuild: true,
    applyToEnvironment: (env) => env.name === "nitro",

    buildApp: {
      // Clean the output directory before any environment is built
      order: "pre",
      async handler() {
        debug("[prepare] Preparing output directory");
        const nitro = ctx.nitro!;
        await prepare(nitro);
      },
    },
  };
}

function nitroService(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:service",
    enforce: "pre",
    sharedDuringBuild: true,
    applyToEnvironment: (env) => env.name === "nitro",

    resolveId: {
      async handler(id, importer, options) {
        // Virtual modules
        if (id === "#nitro-vite-setup") {
          return { id, moduleSideEffects: true };
        }
        if (id === "#nitro-vite-services") {
          return id;
        }

        // Resolve built-in deps
        if (
          runtimeDependencies.some(
            (dep) => id === dep || id.startsWith(`${dep}/`)
          )
        ) {
          const resolved = await this.resolve(id, importer, {
            ...options,
            skipSelf: true,
          });
          return (
            resolved ||
            resolveModulePath(id, {
              from: ctx.nitro!.options.nodeModulesDirs,
              conditions: ctx.nitro!.options.exportConditions,
              try: true,
            })
          );
        }

        // Resolve relative paths from virtual modules
        if (importer?.startsWith("\0virtual:#nitro-internal-virtual")) {
          const internalRes = await this.resolve(id, import.meta.url, {
            ...options,
            custom: { ...options.custom, skipNoExternals: true },
          });
          if (internalRes) {
            return internalRes;
          }
          const resolvedFromRoot = await this.resolve(
            id,
            ctx.nitro!.options.rootDir,
            { ...options, custom: { ...options.custom, skipNoExternals: true } }
          );
          if (resolvedFromRoot) {
            return resolvedFromRoot;
          }
          const ids = [id];
          if (!/^[./@#]/.test(id)) {
            ids.push(`./${id}`);
          }
          for (const _id of ids) {
            const resolved = resolveModulePath(_id, {
              from: process.cwd(),
              extensions: DEFAULT_EXTENSIONS,
              suffixes: ["", "/index"],
              try: true,
            });
            if (resolved) {
              return resolved;
            }
          }
        }
      },
    },

    load: {
      async handler(id) {
        // Virtual modules
        if (id === "#nitro-vite-setup") {
          return prodSetup(ctx);
        }
      },
    },
  };
}

// --- internal helpers ---

function createContext(pluginConfig: NitroPluginConfig): NitroPluginContext {
  return {
    pluginConfig,
    _entryPoints: {},
    _manifest: {},
    _serviceBundles: {},
  };
}

function useNitro(ctx: NitroPluginContext) {
  if (!ctx.nitro) {
    throw new Error("Nitro instance is not initialized yet.");
  }
  return ctx.nitro;
}

async function setupNitroContext(
  ctx: NitroPluginContext,
  configEnv: ConfigEnv,
  userConfig: UserConfig
) {
  // Initialize a new Nitro instance
  ctx.nitro =
    ctx.pluginConfig._nitro ||
    (await createNitro({
      dev: configEnv.mode === "development",
      rootDir: userConfig.root,
      ...defu(ctx.pluginConfig.config, userConfig.nitro),
    }));

  // Config ssr env as a fetchable ssr service
  if (!ctx.pluginConfig.services?.ssr) {
    ctx.pluginConfig.services ??= {};
    if (userConfig.environments?.ssr === undefined) {
      const ssrEntry = resolveModulePath("./entry-server", {
        from: ["", "app", "src"].flatMap((d) =>
          ctx.nitro!.options.scanDirs.map((s) => join(s, d) + "/")
        ),
        extensions: DEFAULT_EXTENSIONS,
        try: true,
      });
      if (ssrEntry) {
        ctx.pluginConfig.services.ssr = { entry: ssrEntry };
        ctx.nitro!.logger.info(
          `Using \`${prettyPath(ssrEntry)}\` as vite ssr entry.`
        );
      }
    } else {
      let ssrEntry = getEntry(
        userConfig.environments.ssr.build?.rollupOptions?.input
      );
      if (typeof ssrEntry === "string") {
        ssrEntry =
          resolveModulePath(ssrEntry, {
            from: ctx.nitro.options.scanDirs,
            extensions: DEFAULT_EXTENSIONS,
            suffixes: ["", "/index"],
            try: true,
          }) || ssrEntry;
        ctx.pluginConfig.services.ssr = { entry: ssrEntry };
      } else {
        throw new TypeError(`Invalid input type for SSR entry point.`);
      }
    }
  }

  // Default SSR renderer
  if (
    !ctx.nitro.options.renderer?.entry &&
    !ctx.nitro.options.renderer?.template &&
    ctx.pluginConfig.services.ssr?.entry
  ) {
    ctx.nitro.options.renderer ??= {};
    ctx.nitro.options.renderer.entry = resolve(
      runtimeDir,
      "internal/vite/ssr-renderer"
    );
  }

  // Determine default Vite dist directory
  const publicDistDir = (ctx._publicDistDir =
    userConfig.build?.outDir ||
    resolve(ctx.nitro.options.buildDir, "vite/public"));
  ctx.nitro.options.publicAssets.push({
    dir: publicDistDir,
    maxAge: 0,
    baseURL: "/",
    fallthrough: true,
  });

  // Nitro Vite Production Runtime
  if (!ctx.nitro.options.dev) {
    ctx.nitro.options.unenv.push({
      meta: { name: "nitro-vite" },
      polyfill: ["#nitro-vite-setup"],
    });
  }

  // Call build:before hook **before resolving rollup config** for compatibility
  await ctx.nitro.hooks.callHook("build:before", ctx.nitro);

  // Resolve common rollup options
  ctx.rollupConfig = await getViteRollupConfig(ctx);

  // Call rollup:before hook to allow modifying rollup config
  await ctx.nitro.hooks.callHook(
    "rollup:before",
    ctx.nitro,
    ctx.rollupConfig.config
  );

  // Create dev worker
  if (ctx.nitro.options.dev && !ctx.devWorker) {
    ctx.devWorker = createDevWorker(ctx);
  }

  // Create dev app
  if (ctx.nitro.options.dev && !ctx.devApp) {
    ctx.devApp = new NitroDevApp(ctx.nitro);
  }
}

function getEntry(input: InputOption | undefined): string | undefined {
  if (typeof input === "string") {
    return input;
  } else if (Array.isArray(input) && input.length > 0) {
    return input[0];
  } else if (input && "index" in input) {
    return input.index as string;
  }
}
