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
import { createNitro, prepare, writeTypes } from "../../builder.ts";
import { installModules } from "../../module.ts";
import { getBundlerConfig } from "./bundler.ts";
import { buildEnvironments } from "./prod.ts";
import {
  initEnvRunner,
  getEnvRunner,
  createNitroEnvironment,
  createServiceEnvironments,
  createServiceEnvironment,
} from "./env.ts";
import { runtimeDir } from "nitro/meta";
import { resolveModulePath } from "exsolve";
import { defu } from "defu";
import { prettyPath } from "../../utils/fs.ts";
import { NitroDevApp } from "../../dev/app.ts";
import { nitroPreviewPlugin } from "./preview.ts";
import assetsPlugin from "@hiogawa/vite-plugin-fullstack/assets";
import type { NitroConfig, NitroModule } from "nitro/types";
import { nitroDevServiceProxy, viteServicesTemplate } from "./services.ts";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

const DEFAULT_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"];

const debug = process.env.NITRO_DEBUG
  ? (...args: any[]) => console.log("[nitro]", ...args)
  : () => {};

export function nitro(pluginConfig: NitroPluginConfig = {}): VitePlugin[] {
  if ((globalThis as any).__nitro_build__) {
    // We are in `nitro build` context. Nitro injects vite plugin itself
    return [];
  }
  const ctx: NitroPluginContext = createContext(pluginConfig);
  return [
    nitroInit(ctx),
    nitroEnv(ctx),
    nitroMain(ctx),
    nitroPrepare(ctx),
    nitroDevServiceProxy(),
    nitroPreviewPlugin(ctx),
    pluginConfig.experimental?.vite?.assetsImport !== false &&
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

    configResolved(config) {
      // Vite resolves its plugin list *before* running config hooks, so a plugin added by
      // another plugin's `config` hook is discovered by Nitro but silently ignored by Vite.
      for (const plugin of ctx._pluginModules || []) {
        if (!config.plugins.some((p) => p === plugin || p.nitro === plugin.nitro)) {
          useNitro(ctx).logger.warn(
            `Vite plugin \`${plugin.name}\` registers a Nitro module but is not applied by Vite. ` +
              `Plugins added from a \`config\` hook are ignored by Vite; add it to \`plugins\` instead.`
          );
        }
      }
    },

    applyToEnvironment(env) {
      if (env.name === "nitro" && ctx.nitro?.options.dev) {
        debug("[init] Adding rollup plugins for dev");
        const plugins =
          (ctx.bundlerConfig?.rolldownConfig?.plugins as VitePlugin[]) ||
          (ctx.bundlerConfig?.rollupConfig?.plugins as VitePlugin[]) ||
          [];
        return [...(plugins || [])];
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
        debug("[env]  Configuring client environment", name === "client" ? "" : ` (${name})`);
        const nitro = useNitro(ctx);
        config.build!.emptyOutDir = false;
        config.build!.outDir = nitro.options.output.publicDir;
        config.build!.copyPublicDir ??= false;
        // Relocate generated client assets (e.g. under `_vercel/immutable`) so
        // both client and SSR references point at the immutable base.
        if (nitro.options.buildAssetsDir) {
          config.build!.assetsDir = nitro.options.buildAssetsDir;
          // Content-addressed (immutable) assets benefit from longer content
          // hashes to reduce collision risk across deployments. Only upgrade the
          // default `[hash]` token to a longer one; never override filename
          // patterns explicitly set by the user or other plugins.
          useLongerAssetHashes(config.build!, ctx._isRolldown, nitro.options.buildAssetsDir);
        }
        return;
      }

      const nitro = useNitro(ctx);
      if (name === "ssr" && nitro.options.buildAssetsDir) {
        config.build!.assetsDir = nitro.options.buildAssetsDir;
        useLongerAssetHashes(config.build!, ctx._isRolldown, nitro.options.buildAssetsDir);
      }

      // Skip if already registered as a service
      if (name === "nitro" || ctx.services[name]) {
        return;
      }

      // Auto-register server consumer environments as services
      const entry = getEntry(
        config.build?.rolldownOptions?.input || config.build?.rollupOptions?.input
      );
      if (typeof entry !== "string") {
        return;
      }

      // Resolve and register as a service
      const resolvedEntry =
        resolveModulePath(entry, {
          from: [ctx.nitro!.options.rootDir, ...ctx.nitro!.options.scanDirs],
          extensions: DEFAULT_EXTENSIONS,
          suffixes: ["", "/index"],
          try: true,
        }) || entry;

      ctx.services[name] = { entry: resolvedEntry };
      debug(`[env]  Auto-detected service "${name}" with entry: ${resolvedEntry}`);

      // Return service environment configuration to merge
      return createServiceEnvironment(ctx, name, { entry: resolvedEntry });
    },

    configResolved() {
      // Setup default SSR renderer after all environments are configured
      if (
        !ctx.nitro!.options.renderer?.handler &&
        !ctx.nitro!.options.renderer?.template &&
        ctx.services.ssr?.entry
      ) {
        ctx.nitro!.options.renderer ??= {};
        ctx.nitro!.options.renderer.handler = resolve(runtimeDir, "internal/vite/ssr-renderer");
        ctx.nitro!.routing.sync();
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
      if (!ctx.bundlerConfig) {
        throw new Error("Bundler config is not initialized yet!");
      }
      return {
        appType: userConfig.appType || "custom",
        resolve: {
          // TODO: environment specific aliases not working
          // https://github.com/vitejs/vite/pull/17583 (seems not effective)
          alias: ctx.bundlerConfig.base.aliases,
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
        debug("[main] Generating manifest and entry points for environment:", environment.name);
        const serviceNames = Object.keys(ctx.services);
        const isRegisteredService = serviceNames.includes(environment.name);

        // Find entry point of this service
        let entryFile: string | undefined;
        const serviceEntry =
          isRegisteredService && ctx.services[environment.name]?.entry
            ? resolve(ctx.services[environment.name].entry)
            : undefined;
        for (const [_name, file] of Object.entries(bundle)) {
          if (file.type === "chunk" && isRegisteredService && file.isEntry) {
            if (
              serviceEntry &&
              file.facadeModuleId &&
              resolve(file.facadeModuleId) === serviceEntry
            ) {
              entryFile = file.fileName;
              break;
            }
            // Fallback: use first entry chunk if no facadeModuleId match
            if (entryFile === undefined) {
              entryFile = file.fileName;
            }
          }
        }
        if (isRegisteredService) {
          if (entryFile === undefined) {
            this.error(`No entry point found for service "${this.environment.name}".`);
          }
          ctx._entryPoints![this.environment.name] = entryFile!;
        }
      },
    },

    configureServer: async (server) => {
      debug("[main] Configuring dev server");
      const { configureViteDevServer } = await import("./dev.ts");
      return configureViteDevServer(ctx, server);
    },

    // Invalidate server-only modules and optionally reload the browser
    // see: https://github.com/vitejs/vite/issues/19114
    async hotUpdate({ server, modules, timestamp }) {
      if (ctx.pluginConfig.experimental?.vite?.serverReload === false) {
        return;
      }
      const env = this.environment;
      if (env.config.consumer === "client") {
        return;
      }
      const clientEnvs = Object.values(server.environments).filter(
        (env) => env.config.consumer === "client"
      );
      const serverOnlyModules: EnvironmentModuleNode[] = [];
      const sharedModules: EnvironmentModuleNode[] = [];
      const invalidated = new Set<EnvironmentModuleNode>();
      for (const mod of modules) {
        if (mod.id && !clientEnvs.some((env) => env.moduleGraph.getModuleById(mod.id!))) {
          serverOnlyModules.push(mod);
          env.moduleGraph.invalidateModule(mod, invalidated, timestamp, false);
        } else {
          sharedModules.push(mod);
        }
      }
      if (serverOnlyModules.length > 0) {
        env.hot.send({ type: "full-reload" });
        if (sharedModules.length === 0 && serverOnlyModules.some((m) => m.environment !== "ssr")) {
          server.ws.send({ type: "full-reload" });
        }
        return sharedModules;
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

// --- internal helpers ---

function createContext(pluginConfig: NitroPluginConfig): NitroPluginContext {
  return {
    pluginConfig,
    services: { ...pluginConfig.experimental?.vite?.services },
    _entryPoints: {},
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
  // When using `nitro build`, a pre-initialized nitro instance is provided
  const providedNitro = ctx.pluginConfig._nitro;

  // Nitro config overrides
  const nitroConfig: NitroConfig = {
    dev: configEnv.command === "serve",
    builder: "vite",
    rootDir: userConfig.root,
    ...defu(
      ctx.pluginConfig,
      (ctx.pluginConfig as any).config, // TODO: Remove shortly
      userConfig.nitro
    ),
  };

  // Register Nitro modules from Vite plugins
  ctx._pluginModules = (await flattenPlugins(userConfig, configEnv)).filter((p) => p.nitro);
  const pluginModules = ctx._pluginModules.map((p) => p.nitro!);
  nitroConfig.modules = [...(nitroConfig.modules || []), ...pluginModules];

  // Register service entries VFS
  const vServicesId = "#nitro/virtual/vite-services";
  nitroConfig.virtual ??= {};
  nitroConfig.virtual[vServicesId] = () => viteServicesTemplate(ctx);
  if (providedNitro) {
    providedNitro.options.virtual[vServicesId] = nitroConfig.virtual[vServicesId];
  }

  // @see https://vite.dev/guide/env-and-mode#env-files
  const dotenvFileNames = [".env", ".env.local"];
  if (configEnv.mode) {
    dotenvFileNames.push(`.env.${configEnv.mode}`, `.env.${configEnv.mode}.local`);
  }

  // Initialize a new Nitro instance
  ctx.nitro =
    providedNitro || (await createNitro(nitroConfig, { dotenv: { fileName: dotenvFileNames } }));

  // Install Vite plugin modules on the provided instance (`nitro build`)
  if (providedNitro && pluginModules.length > 0) {
    providedNitro.options.modules = nitroConfig.modules;
    await installModules(providedNitro, pluginModules);
  }

  // Config ssr env as a fetchable ssr service
  if (!ctx.services?.ssr) {
    if (userConfig.environments?.ssr === undefined) {
      const ssrEntry = resolveModulePath("./entry-server", {
        from: ["app", "src", ""].flatMap((d) =>
          [ctx.nitro!.options.rootDir, ...ctx.nitro!.options.scanDirs].map((s) => join(s, d) + "/")
        ),
        extensions: DEFAULT_EXTENSIONS,
        try: true,
      });
      if (ssrEntry) {
        ctx.services.ssr = { entry: ssrEntry };
        ctx.nitro!.logger.info(`Using \`${prettyPath(ssrEntry)}\` as vite ssr entry.`);
      }
    } else {
      let ssrEntry = getEntry(userConfig.environments.ssr.build?.rollupOptions?.input);
      if (typeof ssrEntry === "string") {
        ssrEntry =
          resolveModulePath(ssrEntry, {
            from: [ctx.nitro.options.rootDir, ...ctx.nitro.options.scanDirs],
            extensions: DEFAULT_EXTENSIONS,
            suffixes: ["", "/index"],
            try: true,
          }) || ssrEntry;
        ctx.services.ssr = { entry: ssrEntry };
      }
    }
  }
  if (
    ctx.nitro.options.serverEntry &&
    ctx.nitro.options.serverEntry.handler === ctx.services.ssr?.entry
  ) {
    ctx.nitro.logger.warn(
      `Nitro server entry and Vite SSR both set to ${prettyPath(ctx.services.ssr.entry)}. Use a separate SSR entry (e.g. \`src/server.ts\`).`
    );
    ctx.nitro.options.serverEntry = false;
  }

  // Determine default Vite dist directory
  const publicDistDir = (ctx._publicDistDir =
    userConfig.build?.outDir || resolve(ctx.nitro.options.buildDir, "vite/public"));
  ctx.nitro.options.publicAssets.push({
    dir: publicDistDir,
    maxAge: 0,
    baseURL: "/",
    fallthrough: true,
  });

  // Call build:before hook **before resolving rollup config** for compatibility
  await ctx.nitro.hooks.callHook("build:before", ctx.nitro);

  // Resolve common rollup options
  ctx.bundlerConfig = await getBundlerConfig(ctx);

  // Call rollup:before hook to allow modifying rollup config
  await ctx.nitro.hooks.callHook(
    "rollup:before",
    ctx.nitro,
    ctx.bundlerConfig.rollupConfig || (ctx.bundlerConfig.rolldownConfig as any)
  );

  // Generate types (runtime config, imports, routes)
  await writeTypes(ctx.nitro);

  // Warm up env runner for dev
  if (ctx.nitro.options.dev) {
    await initEnvRunner(ctx);
  }

  // Attach nitro.fetch to env runner
  ctx.nitro.fetch = (req) => getEnvRunner(ctx).fetch(req);

  // Create dev app
  if (ctx.nitro.options.dev && !ctx.devApp) {
    ctx.devApp = new NitroDevApp(ctx.nitro);
  }

  // Cleanup resources after close {
  ctx.nitro.hooks.hook("close", async () => {
    if (ctx._envRunner) {
      await ctx._envRunner.close();
    }
  });
}

// Upgrade the default `[hash]` filename token to a longer content hash for a
// build environment's output. Filename patterns already configured (by the user
// or other plugins) are only touched to lengthen a bare `[hash]`; explicit
// `[hash:n]` tokens and non-string patterns are left untouched.
//
// Applied identically to the client and the server (SSR) environments so a
// shared asset resolves to the same filename on both sides. A user/framework
// that overrides `assetFileNames` is responsible for keeping the two in sync
// (and such assets opt out of the `buildAssetsDir` immutable base).
export function useLongerAssetHashes(
  build: NonNullable<EnvironmentOptions["build"]>,
  isRolldown: boolean | undefined,
  assetsDir: string
): void {
  const options = ((build as any)[isRolldown ? "rolldownOptions" : "rollupOptions"] ??= {});
  const outputs = Array.isArray(options.output) ? options.output : [(options.output ??= {})];
  const defaults: Record<string, string> = {
    entryFileNames: `${assetsDir}/[name]-[hash:16].js`,
    chunkFileNames: `${assetsDir}/[name]-[hash:16].js`,
    assetFileNames: `${assetsDir}/[name]-[hash:16][extname]`,
  };
  for (const output of outputs) {
    for (const key of Object.keys(defaults)) {
      const current = output[key];
      if (current === undefined) {
        // Not set: opt into a longer-hash default matching Vite's own pattern.
        output[key] = defaults[key];
      } else if (typeof current === "string" && current.includes("[hash]")) {
        // Already set: only lengthen a bare `[hash]` token, keep the rest as-is.
        output[key] = current.replaceAll("[hash]", `[hash:16]`);
      }
    }
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

// Flatten and filter user plugins with the same semantics Vite uses to resolve them.
// (Vite filters by `apply` before calling config hooks but keeps `config.plugins` unfiltered)
// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/config.ts
async function flattenPlugins(userConfig: UserConfig, configEnv: ConfigEnv): Promise<VitePlugin[]> {
  const flat = async (plugins: PluginOption[]): Promise<VitePlugin[]> => {
    const resolved = await Promise.all(plugins);
    const result: VitePlugin[] = [];
    for (const plugin of resolved) {
      if (!plugin) {
        continue;
      }
      if (Array.isArray(plugin)) {
        result.push(...(await flat(plugin)));
      } else {
        result.push(plugin as VitePlugin);
      }
    }
    return result;
  };

  const plugins = await flat(userConfig.plugins || []);

  return plugins.filter((plugin) => {
    if (!plugin.apply) {
      return true;
    }
    return typeof plugin.apply === "function"
      ? plugin.apply({ ...userConfig, mode: configEnv.mode }, configEnv)
      : plugin.apply === configEnv.command;
  });
}
