import type { Plugin as VitePlugin } from "vite";
import type { Plugin as RollupPlugin } from "rollup";
import type { NitroPluginConfig, NitroPluginContext } from "./types";

import { resolve } from "node:path";
import { createNitro, prepare } from "../..";
import { getViteRollupConfig } from "./rollup";
import { buildProduction, prodEntry } from "./prod";
import { createNitroEnvironment, createServiceEnvironments } from "./env";
import { configureViteDevServer } from "./dev";
import { runtimeDir } from "nitro/runtime/meta";

import * as rou3 from "rou3";
import * as rou3Compiler from "rou3/compiler";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

export async function nitro(
  pluginConfig: NitroPluginConfig = {}
): Promise<VitePlugin> {
  const ctx: NitroPluginContext = {
    pluginConfig,
  };

  return {
    name: "nitro",

    // Opt-in this plugin into the shared plugins pipeline
    sharedDuringBuild: true,

    // Extend vite config before it's resolved
    async config(userConfig, configEnv) {
      // Initialize a new Nitro instance
      ctx.nitro = await createNitro({
        dev: configEnv.mode === "development",
        rootDir: userConfig.root,
        compatibilityDate: "latest",
        imports: false,
        typescript: {
          generateRuntimeConfigTypes: false,
          generateTsConfig: false,
        },
        handlers: [
          {
            route: "/**",
            handler: resolve(runtimeDir, "internal/vite/dispatcher.mjs"),
          },
        ],
        ...pluginConfig.config,
      });

      // Cleanup build directories
      await prepare(ctx.nitro);

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
          polyfill: ["#nitro-vite-entry"],
        });
      }

      // Call build:before hook **before resolving rollup config** for compatibility
      await ctx.nitro.hooks.callHook("build:before", ctx.nitro);

      // Resolve common rollup options
      ctx.rollupConfig = await getViteRollupConfig(ctx.nitro);

      return {
        // Don't include HTML middlewares
        appType: userConfig.appType || "custom",

        // Add Nitro as a Vite environment
        environments: {
          ...createServiceEnvironments(ctx),
          nitro: createNitroEnvironment(ctx),
        },

        resolve: {
          // TODO: environment specific aliases not working
          // https://github.com/vitejs/vite/pull/17583 (seems not effective)
          alias: ctx.rollupConfig.base.aliases,
        },

        build: {
          // TODO: Support server environment emitted assets
          assetsInlineLimit: 4096 * 4,
        },

        builder: {
          /// Share the config instance among environments to align with the behavior of dev server
          sharedConfigBuild: true,
          async buildApp(builder) {
            await buildProduction(ctx, builder);
          },
        },
      };
    },

    // Modify environment configs before it's resolved.
    configEnvironment(name, config) {
      const mayBeClient = config.consumer === undefined && name === "client";
      if (config.consumer === "client" || mayBeClient) {
        config.build!.manifest = true;
        config.build!.emptyOutDir = false;
        config.build!.outDir = ctx.nitro!.options.output.publicDir;
      }
    },

    // Extend Vite dev server with Nitro middleware
    configureServer: (server) => configureViteDevServer(ctx, server),

    async resolveId(id, importer, options) {
      // Only apply to Nitro environment
      if (this.environment.name !== "nitro") return;

      // Virtual modules
      if (id === "#nitro-vite-entry") {
        return { id, moduleSideEffects: true };
      }
      if (id === "#nitro-vite-services") {
        return id;
      }

      // Run through rollup compatible plugins to resolve virtual modules
      for (const plugin of ctx.rollupConfig!.config.plugins as RollupPlugin[]) {
        if (typeof plugin.resolveId !== "function") continue;
        const resolved = await plugin.resolveId.call(
          this,
          id,
          importer,
          options
        );
        if (resolved) {
          return resolved;
        }
      }
    },

    async load(id) {
      // Only apply to Nitro environment
      if (this.environment.name !== "nitro") return;

      // Virtual modules
      if (id === "#nitro-vite-entry") {
        return prodEntry(ctx);
      }
      if (id === "#nitro-vite-services") {
        const router = rou3.createRouter();
        for (const [name, service] of Object.entries(
          ctx.pluginConfig.services || {}
        )) {
          const route = service.route || (name === "ssr" ? "/**" : undefined);
          if (!route) {
            continue;
          }
          rou3.addRoute(router, "", route, { service: name });
        }
        return `export const findService = ${rou3Compiler.compileRouterToString(router)};`;
      }

      // Run through rollup compatible plugins to load virtual modules
      for (const plugin of ctx.rollupConfig!.config.plugins as RollupPlugin[]) {
        if (typeof plugin.load !== "function") continue;
        const resolved = await plugin.load.call(this, id);
        if (resolved) {
          return resolved;
        }
      }
    },
  };
}
