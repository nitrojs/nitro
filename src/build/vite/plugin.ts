import type { FetchableDevEnvironment, Plugin as VitePlugin } from "vite";
import type { Plugin as RollupPlugin } from "rollup";
import type { Nitro, NitroConfig } from "nitro/types";
import { resolve } from "node:path";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { copyPublicAssets, createNitro, prepare, prerender } from "../..";
import { createNitroDevEnvironment } from "./dev";
import { resolveModulePath } from "exsolve";
import { getViteRollupConfig } from "./config";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

export async function nitro(nitroConfig?: NitroConfig): Promise<VitePlugin> {
  let nitro: Nitro;
  let rollupConfig: ReturnType<typeof getViteRollupConfig>;

  return {
    name: "nitro",

    // Opt-in this plugin into the shared plugins pipeline
    sharedDuringBuild: true,

    // Extend vite config before it's resolved
    async config(userConfig, configEnv) {
      // Initialize a new Nitro instance
      nitro = await createNitro({
        dev: configEnv.mode === "development",
        rootDir: userConfig.root,
        ...nitroConfig,
      });

      // Cleanup build directories
      await prepare(nitro);

      // Determine default Vite dist directory
      const publicDistDir =
        userConfig.build?.outDir || resolve(nitro.options.buildDir, "public");
      nitro.options.publicAssets.push({
        dir: publicDistDir,
        maxAge: 0,
        baseURL: "/",
        fallthrough: true,
      });

      // Resolve common rollup options
      rollupConfig = await getViteRollupConfig(nitro);

      return {
        environments: {
          nitro: {
            consumer: "server",
            build: {
              rollupOptions: rollupConfig.config,
              minify: nitro.options.minify,
              commonjsOptions: {
                strictRequires: "auto", // TODO: set to true (default) in v3
                esmExternals: (id) => !id.startsWith("unenv/"),
                requireReturnsDefault: "auto",
                ...(nitro.options.commonJS as any),
              },
            },
            resolve: {
              noExternal: nitro.options.dev ? undefined : true,
              conditions: nitro.options.exportConditions,
              externalConditions: nitro.options.exportConditions,
              // https://github.com/vitejs/vite/pull/17583 (seems not effective)
              // alias: rollupOptions._base.aliases,
            },
            dev: {
              createEnvironment: (name, config) =>
                createNitroDevEnvironment(name, config, nitro),
            },
          },
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
            const nitroEnv = builder.environments.nitro;

            // Build all environments before to the final Nitro server bundle
            await Promise.all(
              Object.values(builder.environments).map(
                (env) => env !== nitroEnv && builder.build(env)
              )
            );

            // Build the Nitro server bundle
            await builder.build(nitroEnv);

            // Copy public assets to the final output directory
            await copyPublicAssets(nitro);

            // Prerender routes if configured
            await prerender(nitro);

            // Close the Nitro instance
            await nitro.close();
          },
        },
      };
    },
    // Extend environment configs before they are resolved
    async configEnvironment(name, config) {
      // Prepare other environments for Nitro
      // TODO: Should we opt-in or opt-out envs with a flag indicator?
      if (name === "nitro") {
        return;
      }
      if (config.consumer === "client") {
        if (config.build?.outDir) {
          // TODO
        }
      } else if (config.consumer === "server") {
        // Build server envs into temp directory to resolve
        return {
          build: {
            outDir: resolve(nitro.options.buildDir, "vite/env", name),
          },
        };
      }
    },
    async resolveId(id, importer, options) {
      // Only apply to Nitro environment
      if (this.environment.name !== "nitro") return;

      // Resolve nitro entry
      if (id.startsWith("__nitro_entry__")) {
        return resolveModulePath(nitro.options.entry, {
          extensions: [".mjs", ".ts" /* local dev */],
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
    // Extend Vite dev server with Nitro middleware
    configureServer(server) {
      // defer as last middleware
      return () => {
        server.middlewares.use(async (nodeReq, nodeRes) => {
          const nitroEnv = server.environments.nitro as FetchableDevEnvironment;
          const webReq = new NodeRequest({ req: nodeReq, res: nodeRes });
          const webRes = await nitroEnv.dispatchFetch(webReq);
          await sendNodeResponse(nodeRes, webRes);
        });
      };
    },
  };
}
