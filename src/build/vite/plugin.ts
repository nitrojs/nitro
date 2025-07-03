import type { FetchableDevEnvironment, Plugin as VitePlugin } from "vite";
import type { Plugin as RollupPlugin } from "rollup";
import type { Nitro, NitroConfig } from "nitro/types";
import { resolve } from "node:path";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { copyPublicAssets, createNitro, prepare, prerender } from "../..";
import { getRollupConfig } from "../rollup/config";
import { createNitroDevEnvironment } from "./dev";
import { resolveModulePath } from "exsolve";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

export async function nitro(nitroConfig?: NitroConfig): Promise<VitePlugin> {
  let nitro: Nitro;
  let rollupOptions: ReturnType<typeof getRollupConfig>;

  return {
    name: "nitro",

    // Opt-in this plugin into the shared plugins pipeline
    sharedDuringBuild: true,

    // Modify vite config before it's resolved
    async config(userConfig, configEnv) {
      // Initialize a new Nitro instance
      nitro = await createNitro({
        dev: configEnv.mode === "development",
        rootDir: userConfig.root,
        ...nitroConfig,
      });

      // Prepare build directories
      await prepare(nitro);

      // Resolve common rollup options
      rollupOptions = await getRollupConfig(nitro);

      return {
        environments: {
          nitro: {
            consumer: "server",
            build: { rollupOptions },
            dev: {
              createEnvironment: (name, config) =>
                createNitroDevEnvironment(name, config, nitro),
            },
          },
        },
        builder: {
          async buildApp(builder) {
            // Build all environments before to the final Nitro server bundle
            await Promise.all(
              Object.keys(builder.environments)
                .filter((env) => env !== "nitro")
                .map(
                  (envName) =>
                    [
                      envName,
                      builder.build(builder.environments[envName]),
                    ] as const
                )
            );

            // Copy public assets to the final output directory
            await copyPublicAssets(nitro);

            // Prerender routes if configured
            await prerender(nitro);

            // Build the Nitro server bundle
            await builder.build(builder.environments.nitro);

            // Close the Nitro instance
            await nitro.close();
          },
        },
      };
    },
    // Modify environment configs before they are resolved
    async configEnvironment(name, config) {
      // Prepare other environments for Nitro
      // TODO: Should we opt-in or opt-out envs with a flag indicator?
      if (name === "nitro") {
        return;
      }
      if (config.consumer === "client") {
        // Merge client env outputs into single directory to bundle by Nitro
        return {
          build: {
            outDir: resolve(nitro.options.buildDir, "vite/public"),
          },
        };
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
        return resolveModulePath(nitro.options.entry, { extensions: [".mjs", ".ts" /* local dev */]})
      }

      // Run through rollup compatible plugins to resolve virtual modules
      for (const plugin of rollupOptions.plugins as RollupPlugin[]) {
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
      for (const plugin of rollupOptions.plugins as RollupPlugin[]) {
        if (typeof plugin.load !== "function") continue;
        const resolved = await plugin.load.call(this, id);
        if (resolved) {
          return resolved;
        }
      }
    },
    // Extend Vite dev server with Nitro middleware
    configureServer(server) {
      server.middlewares.use(async (nodeReq, nodeRes) => {
        const nitroEnv = server.environments.nitro as FetchableDevEnvironment;
        const webReq = new NodeRequest({ req: nodeReq, res: nodeRes });
        const webRes = await nitroEnv.dispatchFetch(webReq);
        await sendNodeResponse(nodeRes, webRes);
      });
    },
  };
}
