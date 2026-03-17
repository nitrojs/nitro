import { resolve } from "node:path";
import { promises as fs } from "node:fs";
import type { Nitro } from "nitro/types";
import { findFile } from "pkg-types";
import { resolveModulePath } from "exsolve";
import { presetsDir } from "nitro/meta";
import { importDep } from "../../utils/dep.ts";
import { unenvCfExternals } from "./unenv/preset.ts";

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

  // Compute miniflare options from wrangler config
  const miniflareOptions = await _computeMiniflareOptions(nitro, configPath, devConfig, persistDir);
  if (miniflareOptions) {
    nitro.options.devServer.miniflareOptions = miniflareOptions;
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

async function _computeMiniflareOptions(
  nitro: Nitro,
  configPath: string | undefined,
  devConfig: NonNullable<NonNullable<typeof nitro.options.cloudflare>["dev"]>,
  persistDir: string
): Promise<Record<string, unknown> | undefined> {
  const wrangler = await importDep<typeof import("wrangler")>({
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
  try {
    const bindings =
      wrangler.unstable_convertConfigBindingsToStartWorkerBindings(wranglerConfig);
    if (bindings) {
      const remoteProxySessionData = await wrangler.maybeStartOrUpdateRemoteProxySession(
        {
          name: wranglerConfig.name || "nitro-dev",
          bindings,
          account_id: wranglerConfig.account_id,
        },
        null
      );

      if (remoteProxySessionData) {
        remoteProxyConnectionString = remoteProxySessionData.session.remoteProxyConnectionString;

        // Dispose remote proxy session on close
        nitro.hooks.hook("close", () => {
          return remoteProxySessionData.session.dispose();
        });
      }
    }
  } catch (error) {
    nitro.logger.warn("Failed to set up remote bindings:", error);
  }

  // Get miniflare-ready worker options
  try {
    const { workerOptions } = wrangler.unstable_getMiniflareWorkerOptions(
      wranglerConfig,
      cloudflareEnv,
      {
        remoteProxyConnectionString,
      }
    );

    return {
      ...workerOptions,
      persist: { path: persistDir },
    };
  } catch (error) {
    nitro.logger.warn("Failed to compute miniflare options:", error);
    return undefined;
  }
}
