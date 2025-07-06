import { type FetchableDevEnvironment, type Plugin as VitePlugin } from "vite";
import type { Plugin as RollupPlugin } from "rollup";
import type { Nitro, NitroConfig } from "nitro/types";
import { resolve } from "node:path";
import consola from "consola";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { createNitro, prepare } from "../..";
import { getViteRollupConfig } from "./rollup";
import { buildProduction } from "./prod";
import { createNitroEnvironment, createServiceEnvironments } from "./env";
import { createServer } from "node:http";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

export interface NitroViteService {
  entry: string;
  path?: string;
}

export interface NitroPluginConfig {
  config?: NitroConfig;
  nitro?: Nitro;
  services?: Record<string, NitroViteService>;
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
          ...createServiceEnvironments(
            pluginOptions.services,
            nitro.options.rootDir
          ),
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

    // Full reload browser for Server routes
    handleHotUpdate(context) {
      context.server.hot.send({ type: "full-reload" });
    },

    // Extend Vite dev server with Nitro middleware
    configureServer(server) {
      // Create a sorted array of routable services
      const routableServices = Object.entries(pluginOptions.services || {})
        .filter(([, service]) => service.path)
        .map(([name, service]) => {
          return {
            path: service.path!,
            env: server.environments[name] as FetchableDevEnvironment,
          };
        })
        .sort((a, b) => b.path.length - a.path.length);

      // return () => { /* defer */
      server.middlewares.use(async (nodeReq, nodeRes, next) => {
        // Fast Skip known prefixes
        if (
          nodeReq.url!.startsWith("/@vite/") ||
          nodeReq.url!.startsWith("/@fs/")
        ) {
          return next();
        }

        // Match fetchable environment based on request
        // 1. Check for x-env header
        // 2. Check if the request URL starts with a routable service path
        // 3. Default to nitro environment
        const envHeader = nodeReq.headers["x-env"] as string;
        const env = (server.environments[envHeader] ||
          routableServices.find((s) => nodeReq.url!.startsWith(s.path))?.env ||
          server.environments.nitro) as FetchableDevEnvironment;

        // Make sure the environment is fetchable or else skip
        if (typeof env?.dispatchFetch !== "function") {
          consola.warn("Environment is not fetchable:", env.name);
          return next();
        }

        // Dispatch the request to the environment
        const webReq = new NodeRequest({ req: nodeReq, res: nodeRes });
        const webRes = await env.dispatchFetch(webReq);
        return webRes.status === 404
          ? next()
          : await sendNodeResponse(nodeRes, webRes);
      });
      // };

      // Expose an RPC server to environments
      // TODO: Switch to Unix RPC if all environments are compatible
      const rpcServer = createServer((req, res) => {
        server.middlewares.handle(req, res, () => {});
      });
      rpcServer.listen(0, "localhost", () => {
        const addr = rpcServer.address()!;
        const url =
          typeof addr === "string" ? addr : `http://localhost:${addr.port}`;
        for (const env of Object.values(server.environments)) {
          env.hot.send({ type: "custom", event: "nitro-rpc", data: url });
        }
      });
    },

    async resolveId(id, importer, options) {
      // Only apply to Nitro environment
      if (this.environment.name !== "nitro") return;

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
