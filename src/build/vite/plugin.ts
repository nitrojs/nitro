import { type Plugin as VitePlugin } from "vite";
import type { Plugin as RollupPlugin } from "rollup";
import type { NitroPluginConfig, NitroPluginContext } from "./types";
import { join, resolve, relative } from "pathe";
import { createNitro } from "../..";
import { getViteRollupConfig } from "./rollup";
import { buildProduction, prodEntry } from "./prod";
import { createNitroEnvironment, createServiceEnvironments } from "./env";
import { configureViteDevServer } from "./dev";
import { runtimeDependencies, runtimeDir } from "nitro/runtime/meta";

import * as rou3 from "rou3";
import * as rou3Compiler from "rou3/compiler";
import { resolveModulePath } from "exsolve";
import { prettyPath } from "../../utils/fs";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

export async function nitro(
  pluginConfig: NitroPluginConfig = {}
): Promise<VitePlugin> {
  const ctx: NitroPluginContext = {
    pluginConfig,
    _entryPoints: {},
    _manifest: {},
    _serviceBundles: {},
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

      // Auto config default (ssr) service
      if (!pluginConfig.services?.ssr && !userConfig.environments?.ssr) {
        const serverEntry = resolveModulePath("./server", {
          from: [
            join(ctx.nitro.options.srcDir, "/"),
            join(ctx.nitro.options.rootDir, "src/"),
          ],
          extensions: [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"],
          try: true,
        });
        if (serverEntry) {
          ctx.nitro!.logger.info(
            `Using \`${prettyPath(serverEntry)}\` as the server entry.`
          );
          pluginConfig.services = {
            ssr: { entry: serverEntry },
          };
        }
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
          polyfill: ["#nitro-vite-entry"],
        });
      }

      // Call build:before hook **before resolving rollup config** for compatibility
      await ctx.nitro.hooks.callHook("build:before", ctx.nitro);

      // Resolve common rollup options
      ctx.rollupConfig = await getViteRollupConfig(ctx);

      return {
        // Don't include HTML middlewares
        appType: userConfig.appType || "custom",

        // Add Nitro as a Vite environment
        environments: {
          client: {
            consumer: userConfig.environments?.client?.consumer || "client",
          },
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
        },
      };
    },

    buildApp: {
      order: "post",
      handler(builder) {
        return buildProduction(ctx, builder);
      },
    },

    generateBundle: {
      handler(_options, bundle) {
        const { root } = this.environment.config;
        const services = ctx.pluginConfig.services || {};
        const serviceNames = Object.keys(services);
        const isRegisteredService = serviceNames.includes(
          this.environment.name
        );

        // find entry point of this service
        let entryFile: string | undefined;
        for (const [_name, file] of Object.entries(bundle)) {
          if (file.type === "chunk") {
            if (isRegisteredService && file.isEntry) {
              if (entryFile !== undefined) {
                this.error(
                  `Multiple entry points found for service "${this.environment.name}". Only one entry point is allowed.`
                );
              }
              entryFile = file.fileName;
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

    // Modify environment configs before it's resolved.
    configEnvironment(name, config) {
      if (config.consumer === "client") {
        config.build!.manifest = true;
        config.build!.emptyOutDir = false;
        config.build!.outDir = ctx.nitro!.options.output.publicDir;
      }

      const services = ctx.pluginConfig.services || {};
      const serviceNames = Object.keys(services);
      if (serviceNames.includes(name)) {
        // we don't write to the file system
        // instead, the generateBundle hook will capture the output and write it to the virtual file system to be used by the nitro build later
        if (config.build) {
          config.build.write = false;
        } else {
          config.build = { write: false };
        }
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
