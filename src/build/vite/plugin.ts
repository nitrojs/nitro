import type {
  ConfigEnv,
  FetchableDevEnvironment,
  UserConfig,
  Plugin as VitePlugin,
} from "vite";
import type { Plugin as RollupPlugin } from "rollup";
import type { Nitro, NitroConfig } from "nitro/types";
import { join, resolve } from "node:path";
import consola from "consola";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { createNitro, prepare } from "../..";
import { getViteRollupConfig } from "./rollup";
import { buildProduction } from "./prod";
import { createNitroEnvironment, createServiceEnvironments } from "./env";
import { createServer } from "node:http";
import { tmpdir } from "node:os";

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

      // Nitro Vite Production Runtime
      if (!nitro.options.dev) {
        nitro.options.unenv.push({
          meta: { name: "nitro-vite" },
          polyfill: ["#nitro-vite"],
        });
      }

      // Call build:before hook **before resolving rollup config** for compatibility
      await nitro.hooks.callHook("build:before", nitro);

      // Resolve common rollup options
      rollupConfig = await getViteRollupConfig(nitro);

      return {
        // Don't include HTML middlewares
        appType: userConfig.appType || "custom",

        // Add Nitro as a Vite environment
        environments: {
          ...createServiceEnvironments(pluginOptions.services, nitro),
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
          // // Share the config instance among environments to align with the behavior of dev server
          sharedConfigBuild: true,

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
      const rpcServer = createServer((req, res) => {
        server.middlewares.handle(req, res, () => {});
      });
      rpcServer.listen(getSocketAddress(), () => {
        const addr = rpcServer.address()!;
        for (const env of Object.values(server.environments)) {
          env.hot.send({
            type: "custom",
            event: "nitro-rpc",
            data:
              typeof addr === "string"
                ? { socketPath: addr }
                : // prettier-ignore
                  { host: `${addr.address.includes(":")? `[${addr.address}]`: addr.address}:${addr.port}`, },
          });
        }
      });
    },

    async resolveId(id, importer, options) {
      // Only apply to Nitro environment
      if (this.environment.name !== "nitro") return;

      // Virtual modules
      if (id === "#nitro-vite") {
        return { id, moduleSideEffects: true };
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

      // Virtual modules
      if (id === "#nitro-vite") {
        const services = pluginOptions.services || {};
        const serviceNames = Object.keys(services);
        return [
          `const services = { ${serviceNames.map((name) => `[${JSON.stringify(name)}]: () => import("${resolve(nitro.options.buildDir, "vite/services", name)}")`)}};`,
          /* js */ `
            const serviceHandlers = {};
            const originalFetch = globalThis.fetch;
            globalThis.fetch = (input, init) => {
              if (!init?.env) {
                return originalFetch(input, init);
              }
              if (typeof input === "string" && input[0] === "/") {
                input = new URL(input, "http://localhost");
              }
              const req = new Request(input, init);
              if (serviceHandlers[init.env]) {
                return Promise.resolve(serviceHandlers[init.env](req));
              }
              return services[init.env]().then((mod) => {
                const fetchHandler = mod.fetch || mod.default?.fetch;
                serviceHandlers[init.env] = fetchHandler;
                return fetchHandler(req);
              });
            };
          `,
        ].join("\n");
      }

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

function getSocketAddress() {
  const socketName = `nitro-vite-${process.pid}-${Math.round(Math.random() * 10_000)}.sock`;
  // Windows: pipe
  if (process.platform === "win32") {
    return join(String.raw`\\.\pipe`, socketName);
  }
  // Linux: abstract namespace
  if (process.platform === "linux") {
    const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
    if (nodeMajor >= 20) {
      return `\0${socketName}`;
    }
  }
  // Unix socket
  return join(tmpdir(), socketName);
}
