import type {
  ConfigEnv,
  EnvironmentModuleNode,
  EnvironmentOptions,
  PluginOption,
  UserConfig,
  Plugin as VitePlugin,
} from "vite";
import type { InputOption } from "rollup";
import type { NitroPluginConfig, NitroPluginContext } from "./types.ts";
import { resolve, join } from "pathe";
import { createNitro, prepare } from "../../builder.ts";
import { getViteRollupConfig } from "./rollup.ts";
import { buildEnvironments, prodSetup } from "./prod.ts";
import {
  createDevWorker,
  createNitroEnvironment,
  createServiceEnvironments,
} from "./env.ts";
import { configureViteDevServer } from "./dev.ts";
import { runtimeDir } from "nitro/runtime/meta";
import { resolveModulePath } from "exsolve";
import { defu } from "defu";
import { prettyPath } from "../../utils/fs.ts";
import { NitroDevApp } from "../../dev/app.ts";
import { nitroPreviewPlugin } from "./preview.ts";
import { assetsPlugin } from "@hiogawa/vite-plugin-fullstack";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

const DEFAULT_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"];

const debug = process.env.NITRO_DEBUG
  ? (...args: any[]) => console.log("[nitro]", ...args)
  : () => {};

export function nitro(pluginConfig: NitroPluginConfig = {}): VitePlugin[] {
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
  ].filter(Boolean) as VitePlugin[];
}

function nitroInit(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:init",
    sharedDuringBuild: true,
    apply: (_config, configEnv) => !configEnv.isPreview,

    async config(config, configEnv) {
      ctx._isRolldown = !!(this.meta as Record<string, string>).rolldownVersion;
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
        experimental: {
          // TODO: Fix issue with rolldown-vite native plugins
          ...({ enableNativePlugin: false } as any),
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
        const services = ctx.pluginConfig.services || {};
        const serviceNames = Object.keys(services);
        const isRegisteredService = serviceNames.includes(environment.name);

        // Find entry point of this service
        let entryFile: string | undefined;
        for (const [_name, file] of Object.entries(bundle)) {
          if (file.type === "chunk" && isRegisteredService && file.isEntry) {
            if (entryFile === undefined) {
              entryFile = file.fileName;
            } else {
              this.warn(
                `Multiple entry points found for service "${environment.name}"`
              );
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

    // Automatically reload the client when a server module is updated
    // see: https://github.com/vitejs/vite/issues/19114
    async hotUpdate({ server, modules, timestamp }) {
      const env = this.environment;
      if (
        ctx.pluginConfig.experimental?.serverReload === false ||
        env.config.consumer === "client"
      ) {
        return;
      }
      const clientEnvs = Object.values(server.environments).filter(
        (env) => env.config.consumer === "client"
      );
      let hasServerOnlyModule = false;
      const invalidated = new Set<EnvironmentModuleNode>();
      for (const mod of modules) {
        if (
          mod.id &&
          !clientEnvs.some((env) => env.moduleGraph.getModuleById(mod.id!))
        ) {
          hasServerOnlyModule = true;
          env.moduleGraph.invalidateModule(mod, invalidated, timestamp, false);
        }
      }
      if (hasServerOnlyModule) {
        env.hot.send({ type: "full-reload" });
        server.ws.send({ type: "full-reload" });
        return [];
      }
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
      async handler(id) {
        // Virtual modules
        if (id === "#nitro-vite-setup") {
          return { id, moduleSideEffects: true };
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
  // Nitro config overrides
  const nitroConfig = {
    dev: configEnv.command === "serve",
    rootDir: userConfig.root,
    ...defu(ctx.pluginConfig.config, userConfig.nitro),
  };

  // Register Nitro modules from Vite plugins
  nitroConfig.modules ??= [];
  for (const plugin of flattenPlugins(userConfig.plugins || [])) {
    if (plugin.nitro) {
      nitroConfig.modules.push(plugin.nitro);
    }
  }

  nitroConfig.builder = ctx._isRolldown ? "rolldown-vite" : "vite";
  debug("[init] Using builder:", nitroConfig.builder);

  // Initialize a new Nitro instance
  ctx.nitro = ctx.pluginConfig._nitro || (await createNitro(nitroConfig));

  ctx.nitro.options.builder = ctx._isRolldown ? "rolldown-vite" : "vite";

  // Config ssr env as a fetchable ssr service
  if (!ctx.pluginConfig.services?.ssr) {
    ctx.pluginConfig.services ??= {};
    if (userConfig.environments?.ssr === undefined) {
      const ssrEntry = resolveModulePath("./entry-server", {
        from: ["app", "src", ""].flatMap((d) =>
          [ctx.nitro!.options.rootDir, ...ctx.nitro!.options.scanDirs].map(
            (s) => join(s, d) + "/"
          )
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
            from: [ctx.nitro.options.rootDir, ...ctx.nitro.options.scanDirs],
            extensions: DEFAULT_EXTENSIONS,
            suffixes: ["", "/index"],
            try: true,
          }) || ssrEntry;
        ctx.pluginConfig.services.ssr = { entry: ssrEntry };
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
    ctx.nitro.fetch = (req) => ctx.devWorker!.fetch(req);
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

function flattenPlugins(plugins: PluginOption[]): VitePlugin[] {
  return plugins
    .flatMap((plugin) =>
      Array.isArray(plugin) ? flattenPlugins(plugin) : [plugin]
    )
    .filter((p) => p && !(p instanceof Promise)) as VitePlugin[];
}
