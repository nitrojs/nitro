import type { RsbuildPluginAPI, Rspack } from "@rsbuild/core";
import type { Compiler } from "@rspack/core";
import type { RstestConfig, RstestExposeAPI } from "@rstest/core";
import type { Nitro } from "nitro/types";
import type { DevWatch } from "../rspack/dev.ts";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "pathe";
import { runtimeDir } from "#nitro/meta";
import { checkServerEntry, findSSREntry, useSSRServiceRenderer } from "../services.ts";
import { getRspackConfig } from "../rspack/config.ts";
import { createDevWatch } from "../rspack/dev.ts";
import { RollupPluginsHost } from "../rspack/_plugin.ts";

const NAME = "nitro:rstest";

/**
 * Builds Rstest test files with the server build config of Nitro (aliases, virtual modules and
 * build plugins), so they import `nitro/*` runtime utilities, routes and plugins the same way
 * server code does.
 */
export function setupRstest(api: RsbuildPluginAPI, initNitro: () => Promise<Nitro>): void {
  const rstest = api.useExposed<RstestExposeAPI>("rstest");
  // Browser mode runs test files in a browser
  if (!rstest || rstest.getRstestConfig().browser?.enabled) {
    return;
  }
  const setupPath = resolve(runtimeDir, "internal/rspack/rstest-setup.mjs");
  rstest.modifyRstestConfig((config) => {
    const setupFiles = [config.setupFiles || []].flat();
    if (!setupFiles.includes(setupPath)) {
      config.setupFiles = [...setupFiles, setupPath];
    }
    bundleNitro(config);
  });

  let envName: string | undefined;
  let compiler: Compiler | undefined;
  // The Rspack config can be resolved more than once
  let nitroBuild: Promise<NitroBuild> | undefined;

  api.modifyRspackConfig(async (config, utils) => {
    envName = utils.environment.name;
    const rspack = utils.rspack as unknown as typeof import("@rspack/core");
    const { nitroConfig, pluginsHost } = await (nitroBuild ??= initNitroBuild(
      await initNitro(),
      rspack,
      () => compiler?.watching?.invalidate()
    ));
    // Rsbuild compiles TypeScript and JSX
    const nitroRules = (nitroConfig.module?.rules || []).filter(
      (rule) => !(rule && typeof rule === "object" && rule.loader === "builtin:swc-loader")
    );
    const provide = nitroConfig.plugins?.find((plugin) => plugin instanceof rspack.ProvidePlugin);
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: { ...(nitroConfig.resolve?.alias as object), ...(config.resolve?.alias as object) },
      },
      module: { ...config.module, rules: [...nitroRules, ...(config.module?.rules || [])] },
      plugins: [...(config.plugins || []), pluginsHost, provide].filter(Boolean),
      externals: pluginsHost ? nitroExternals(config.externals, pluginsHost) : config.externals,
    };
  });

  api.onAfterCreateCompiler(async ({ compiler: created }) => {
    const compilers = "compilers" in created ? created.compilers : [created];
    compiler = compilers.find((c) => c.name === envName);
    if (!compiler || !nitroBuild) {
      return;
    }
    // Added or removed handlers render the virtual modules again
    const { devWatch } = await nitroBuild;
    compiler.hooks.watchRun.tapPromise(NAME, (c) => devWatch.invalidateVirtual(c));
  });

  api.onCloseDevServer(async () => {
    if (nitroBuild) {
      const { nitro, devWatch } = await nitroBuild;
      devWatch.close();
      await nitro.close();
    }
  });
}

/** The Nitro runtime imports virtual modules: it is bundled when Rstest externalizes packages. */
function bundleNitro(config: RstestConfig) {
  const output = (config.output ??= {});
  const { bundleDependencies } = output;
  const testEnvironment = config.testEnvironment;
  const environment =
    typeof testEnvironment === "object" ? testEnvironment.name : testEnvironment || "node";
  if (Array.isArray(bundleDependencies)) {
    output.bundleDependencies = [...bundleDependencies, "nitro"];
  } else if (bundleDependencies === false || (!bundleDependencies && environment === "node")) {
    output.bundleDependencies = ["nitro"];
  }
}

/**
 * Rstest externalizes the requests it cannot resolve itself, and sees them before the build
 * plugins of Nitro rewrite them: virtual modules are bundled, and imports of virtual modules are
 * resolved by Nitro (from the runtime or the root directory).
 */
function nitroExternals(
  externals: Rspack.Configuration["externals"],
  pluginsHost: RollupPluginsHost
): Rspack.Configuration["externals"] {
  const { virtual, resolver } = pluginsHost;
  const rootDir = pluginsHost.host.nitro.options.rootDir;
  const resolveData = async (data: Rspack.ExternalItemFunctionData) => {
    const { request, contextInfo } = data;
    const issuer = contextInfo?.issuer;
    const resolved = request ? await resolver.resolve(request, issuer) : undefined;
    if (resolved && !resolved.external && virtual.isVirtual(virtual.toRequest(resolved.id))) {
      return;
    }
    if (!issuer || !virtual.isVirtual(issuer)) {
      return data;
    }
    const id = resolved?.id.startsWith("file:") ? fileURLToPath(resolved.id) : resolved?.id;
    return id && isAbsolute(id) ? { ...data, request: id } : { ...data, context: rootDir };
  };
  return [externals || []].flat().map((item) => {
    // Rstest externals use callbacks
    if (typeof item !== "function" || item.length < 2) {
      return item;
    }
    const external: Rspack.ExternalItem = (data, callback) => {
      resolveData(data).then(
        (resolved) => (resolved ? item(resolved, callback) : callback()),
        (error) => callback(error)
      );
    };
    return external;
  });
}

interface NitroBuild {
  nitro: Nitro;
  nitroConfig: Rspack.Configuration;
  pluginsHost?: RollupPluginsHost;
  devWatch: DevWatch;
}

async function initNitroBuild(
  nitro: Nitro,
  rspack: typeof import("@rspack/core"),
  invalidate: () => void
): Promise<NitroBuild> {
  // Services (e.g. an `entry-server` file) are bundled with the test files
  const { services } = nitro.options;
  if (!services.ssr) {
    const ssrEntry = findSSREntry(nitro);
    if (ssrEntry) {
      services.ssr = { entry: ssrEntry };
    }
  }
  nitro._serviceLoader = (name) => ({ import: services[name]!.entry });
  checkServerEntry(nitro);
  useSSRServiceRenderer(nitro);

  await nitro.hooks.callHook("build:before", nitro);
  const nitroConfig = (await getRspackConfig(nitro, rspack)) as Rspack.Configuration;
  await nitro.hooks.callHook("build:config", nitro, { builder: "rspack", rspack: nitroConfig });
  const pluginsHost = nitroConfig.plugins?.find((plugin) => plugin instanceof RollupPluginsHost);
  const devWatch = createDevWatch(nitro, { pluginsHost, invalidate });
  await devWatch.scan();
  return { nitro, nitroConfig, pluginsHost, devWatch };
}
