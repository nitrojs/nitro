import type { FetchableDevEnvironment, Plugin as VitePlugin } from "vite";
import type { Plugin as RollupPlugin } from "rollup";
import type { Nitro, NitroConfig } from "nitro/types";
import { resolve } from "node:path";
import consola from "consola";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { createNitro, prepare } from "../..";
import { resolveModulePath } from "exsolve";
import { getViteRollupConfig } from "./rollup";
import { buildProduction } from "./prod";
import { createNitroEnvironment } from "./env";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

export interface NitroPluginConfig {
  config?: NitroConfig;
  nitro?: Nitro;
  apps?: Record<string, string>;
}

export async function nitro(
  pluginOptions: NitroPluginConfig = {}
): Promise<VitePlugin> {
  let nitro: Nitro;
  let rollupConfig: ReturnType<typeof getViteRollupConfig>;

  return {
    name: "nitro",

    // Opt-in this plugin into the shared plugins pipeline
    sharedDuringBuild: true,

    // Extend vite config before it's resolved
    async config(userConfig, configEnv) {
      // Initialize a new Nitro instance
      nitro =
        nitro ||
        (await createNitro({
          dev: configEnv.mode === "development",
          rootDir: userConfig.root,
          ...pluginOptions.config,
        }));

      // Cleanup build directories
      await prepare(nitro);

      // Determine default Vite dist directory
      const publicDistDir =
        userConfig.build?.outDir ||
        resolve(nitro.options.buildDir, "vite/public");

      nitro.options.publicAssets.push({
        dir: publicDistDir,
        maxAge: 0,
        baseURL: "/",
        fallthrough: true,
      });

      // Call build:before hook **before resolving rollup config** for compatibility
      await nitro.hooks.callHook("build:before", nitro);

      // Resolve common rollup options
      rollupConfig = await getViteRollupConfig(nitro);

      return {
        // Don't include HTML middlewares
        appType: userConfig.appType || "custom",

        // Add Nitro as a Vite environment
        environments: {
          nitro: createNitroEnvironment(nitro, rollupConfig),
        },

        resolve: {
          // TODO: environment specific aliases not working
          alias: rollupConfig.base.aliases,
        },

        build: {
          outDir: publicDistDir,
        },

        builder: {
          async buildApp(builder) {
            // Build all environments before to the final Nitro server bundle
            for (const [name, env] of Object.entries(builder.environments)) {
              // prettier-ignore
              const fmtName = name.length <= 3 ? name.toUpperCase() : name[0].toUpperCase() + name.slice(1);
              if (name === "nitro") continue;
              if (!env.config.build.rollupOptions.input) {
                // If the environment is a server environment and has no input, skip it
                consola.warn(
                  `Skipping build for \`${fmtName}\` as it has no input.`
                );
                continue;
              }
              consola.start(`Building \`${fmtName}\`...`);
              await builder.build(env);
            }

            // Nitro build
            await buildProduction(nitro, builder);
          },
        },
      };
    },

    // Full reload Server routes on hot update
    handleHotUpdate(context) {
      context.server.hot.send({ type: "full-reload" });
    },

    // Extend Vite dev server with Nitro middleware
    configureServer(server) {
      // return () => { /* defer */
      server.middlewares.use(async (nodeReq, nodeRes, next) => {
        const nitroEnv = server.environments.nitro as FetchableDevEnvironment;
        const webReq = new NodeRequest({ req: nodeReq, res: nodeRes });
        const webRes = await nitroEnv.dispatchFetch(webReq);
        return webRes.status === 404
          ? next()
          : await sendNodeResponse(nodeRes, webRes);
      });
      // };
    },

    async resolveId(id, importer, options) {
      // Only apply to Nitro environment
      if (this.environment.name !== "nitro") return;

      // Resolve nitro entry
      if (id.startsWith("__nitro_entry__")) {
        return resolveModulePath(nitro.options.entry, {
          extensions: [".mjs", ".ts"],
        });
      }

      // Run through rollup compatible plugins to resolve virtual modules
      for (const plugin of rollupConfig.config.plugins as RollupPlugin[]) {
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

      // Run through rollup compatible plugins to load virtual modules
      for (const plugin of rollupConfig.config.plugins as RollupPlugin[]) {
        if (typeof plugin.load !== "function") continue;
        const resolved = await plugin.load.call(this, id);
        if (resolved) {
          return resolved;
        }
      }
    },
  };
}
