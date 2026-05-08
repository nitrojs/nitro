import { resolve } from "node:path";
import { promises as fs } from "node:fs";
import type { Nitro } from "nitro/types";
import { findFile } from "pkg-types";
import { resolveModulePath } from "exsolve";
import { presetsDir } from "nitro/meta";
import { watch } from "chokidar";
import { debounce } from "perfect-debounce";
import { importDep } from "../../utils/dep.ts";
import { unenvCfExternals } from "./unenv/preset.ts";

type Wrangler = typeof import("wrangler");
type RemoteProxySessionData = NonNullable<
  Awaited<ReturnType<Wrangler["maybeStartOrUpdateRemoteProxySession"]>>
>;

export async function cloudflareDevModule(nitro: Nitro) {
  if (!nitro.options.dev) {
    return;
  }

  if (nitro.options.devServer.runner !== "miniflare") {
    throw new Error(
      "Cloudflare dev emulation requires the miniflare runner. Please set `devServer.runner: 'miniflare'` in your nitro config."
    );
  }

  // In miniflare (workerd), cloudflare:* modules are resolved natively
  nitro.options.unenv.push(unenvCfExternals);

  const devConfig = {
    // compatibility with legacy nitro-cloudflare-dev module
    ...(nitro.options as any).cloudflareDev,
    ...nitro.options.cloudflare?.dev,
  } as NonNullable<NonNullable<typeof nitro.options.cloudflare>["dev"]>;

  // Find wrangler.json > wrangler.jsonc > wrangler.toml
  let configPath = devConfig.configPath;
  if (!configPath) {
    configPath = await findFile(["wrangler.json", "wrangler.jsonc", "wrangler.toml"], {
      startingFrom: nitro.options.rootDir,
    }).catch(() => undefined);
  }

  // Resolve the persist dir
  const persistDir = resolve(nitro.options.rootDir, devConfig.persistDir || ".wrangler/state/v3");

  // Add `.wrangler/state/v3` to `.gitignore`
  const gitIgnorePath = await findFile(".gitignore", {
    startingFrom: nitro.options.rootDir,
  }).catch(() => undefined);

  if (gitIgnorePath && !devConfig.persistDir) {
    const gitIgnore = await fs.readFile(gitIgnorePath, "utf8");
    if (!gitIgnore.includes(".wrangler/state/v3")) {
      await fs.writeFile(gitIgnorePath, gitIgnore + "\n.wrangler/state/v3\n").catch(() => {});
    }
  }

  // Track the active remote proxy session so we can update it incrementally on config changes
  let sessionData: RemoteProxySessionData | null = null;
  const apply = (result: ComputeResult) => {
    sessionData = result.sessionData;
    nitro.options.devServer.miniflareOptions = result.miniflareOptions;
    if (result.externalWorkers.length > 0) {
      nitro.logger.warn(
        `Wrangler config produced ${result.externalWorkers.length} external worker(s) (service bindings, assets, etc.). These are not yet supported in Nitro's miniflare dev runner and will be unavailable in dev. Affected workers: ${result.externalWorkers.map((w) => (w as { name?: string }).name || "<unnamed>").join(", ")}.`
      );
    }
  };

  // Initial compute
  const initial = await _computeMiniflareOptions(nitro, configPath, devConfig, persistDir, null);
  if (initial) {
    apply(initial);
    if (initial.define) {
      // `define` is build-time substitution; only applied on initial compute.
      nitro.options.replace = { ...nitro.options.replace, ...initial.define };
    }
  }

  // Dispose the active remote proxy session on Nitro close
  nitro.hooks.hook("close", () => sessionData?.session.dispose());

  // Watch wrangler config for changes and trigger a dev reload
  if (configPath) {
    const watcher = watch(configPath, nitro.options.watchOptions);
    const onChange = debounce(async () => {
      try {
        const next = await _computeMiniflareOptions(
          nitro,
          configPath,
          devConfig,
          persistDir,
          sessionData
        );
        if (!next) return;
        apply(next);
        nitro.logger.info("Wrangler config changed, reloading dev runner...");
        await nitro.hooks.callHook("dev:reload");
      } catch (error) {
        nitro.logger.warn("Failed to reload after wrangler config change:", error);
      }
    });
    watcher.on("change", onChange).on("add", onChange).on("unlink", onChange);
    nitro.hooks.hook("close", () => watcher.close());
  }

  // Add plugin to inject bindings to dev server
  nitro.options.plugins = nitro.options.plugins || [];
  nitro.options.plugins.unshift(
    resolveModulePath("./cloudflare/runtime/plugin.dev", {
      from: presetsDir,
      extensions: [".mjs", ".ts"],
    })
  );
}

interface ComputeResult {
  miniflareOptions: Record<string, unknown>;
  define: Record<string, string> | undefined;
  externalWorkers: unknown[];
  sessionData: RemoteProxySessionData | null;
}

async function _computeMiniflareOptions(
  nitro: Nitro,
  configPath: string | undefined,
  devConfig: NonNullable<NonNullable<typeof nitro.options.cloudflare>["dev"]>,
  persistDir: string,
  prevSessionData: RemoteProxySessionData | null
): Promise<ComputeResult | undefined> {
  const wrangler = await importDep<Wrangler>({
    id: "wrangler",
    dir: nitro.options.rootDir,
    reason: "Cloudflare dev emulation",
  });

  const cloudflareEnv = devConfig.environment || process.env.CLOUDFLARE_ENV;

  // Read wrangler config using wrangler's own parser (handles toml/json/jsonc + environments)
  let wranglerConfig;
  if (configPath) {
    try {
      wranglerConfig = await wrangler.unstable_readConfig({ config: configPath, env: cloudflareEnv });
    } catch (error) {
      nitro.logger.warn("Failed to read wrangler config:", error);
      return undefined;
    }
  }

  // Merge nitroConfig.cloudflare.wrangler overrides on top
  if (nitro.options.cloudflare?.wrangler && wranglerConfig) {
    const { defu } = await import("defu");
    wranglerConfig = defu(nitro.options.cloudflare.wrangler, wranglerConfig);
  }

  if (!wranglerConfig) {
    return undefined;
  }

  // Convert bindings and handle remote proxy session
  let remoteProxyConnectionString;
  let sessionData: RemoteProxySessionData | null = prevSessionData;
  try {
    const bindings =
      wrangler.unstable_convertConfigBindingsToStartWorkerBindings(wranglerConfig);
    if (bindings) {
      const apiToken = devConfig.apiToken || process.env.CLOUDFLARE_API_TOKEN;
      const accountId =
        devConfig.accountId ||
        process.env.CLOUDFLARE_ACCOUNT_ID ||
        wranglerConfig.account_id;
      const auth = apiToken
        ? async () => ({ apiToken: { apiToken }, accountId: accountId || "" })
        : undefined;
      sessionData = await wrangler.maybeStartOrUpdateRemoteProxySession(
        {
          name: wranglerConfig.name || "nitro-dev",
          bindings,
          account_id: accountId,
        },
        prevSessionData,
        auth
      );
      remoteProxyConnectionString = sessionData?.session.remoteProxyConnectionString;
    }
  } catch (error) {
    nitro.logger.warn("Failed to set up remote bindings:", error);
  }

  // Get miniflare-ready worker options
  try {
    const { workerOptions, define, externalWorkers } = wrangler.unstable_getMiniflareWorkerOptions(
      wranglerConfig,
      cloudflareEnv,
      {
        remoteProxyConnectionString,
      }
    );

    return {
      miniflareOptions: {
        ...workerOptions,
        defaultPersistRoot: persistDir,
      },
      define,
      externalWorkers: externalWorkers || [],
      sessionData,
    };
  } catch (error) {
    nitro.logger.warn("Failed to compute miniflare options:", error);
    return undefined;
  }
}
