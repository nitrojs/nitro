import { resolve } from "node:path";
import { promises as fs } from "node:fs";
import type { Nitro } from "nitro/types";
import { findFile } from "pkg-types";
import { resolveModulePath } from "exsolve";
import { presetsDir } from "nitro/meta";

export async function cloudflareDevModule(nitro: Nitro) {
  if (!nitro.options.dev) {
    return; // Production doesn't need this
  }

  nitro.options.unenv.push({
    meta: {
      name: "nitro:cloudflare-dev",
    },
    alias: {
      "cloudflare:workers": resolve(presetsDir, "cloudflare/runtime/shims/workers.dev.mjs"),
    },
  });

  // Try to resolve wrangler
  const wranglerPath = await resolveModulePath("wrangler", {
    from: nitro.options.rootDir,
    try: true,
  });
  if (!wranglerPath) {
    nitro.logger.warn(
      "Wrangler is not installed. Please install it using `npx nypm i wrangler` to enable dev emulation."
    );
    return;
  }

  const config = {
    // compatibility with legacy nitro-cloudflare-dev module
    ...(nitro.options as any).cloudflareDev,
    ...nitro.options.cloudflare?.dev,
  } as NonNullable<NonNullable<typeof nitro.options.cloudflare>["dev"]>;

  // Find wrangler.json > wrangler.jsonc > wrangler.toml
  let configPath = config.configPath;
  if (!configPath) {
    configPath = await findFile(["wrangler.json", "wrangler.jsonc", "wrangler.toml"], {
      startingFrom: nitro.options.rootDir,
    }).catch(() => undefined);
  }

  // Resolve the persist dir
  const persistDir = resolve(nitro.options.rootDir, config.persistDir || ".wrangler/state/v3");

  // Add `.wrangler/state/v3` to `.gitignore`
  const gitIgnorePath = await findFile(".gitignore", {
    startingFrom: nitro.options.rootDir,
  }).catch(() => undefined);

  // let addedToGitIgnore = false;
  if (gitIgnorePath && persistDir === ".wrangler/state/v3") {
    const gitIgnore = await fs.readFile(gitIgnorePath, "utf8");
    if (!gitIgnore.includes(".wrangler/state/v3")) {
      await fs.writeFile(gitIgnorePath, gitIgnore + "\n.wrangler/state/v3\n").catch(() => {});
      // addedToGitIgnore = true;
    }
  }

  // Share config to the runtime
  nitro.options.runtimeConfig.wrangler = {
    ...nitro.options.runtimeConfig.wrangler,
    configPath,
    persistDir,
    environment: config.environment,
  };

  // Add plugin to inject bindings to dev server
  nitro.options.plugins = nitro.options.plugins || [];
  nitro.options.plugins.unshift(
    resolveModulePath("./cloudflare/runtime/plugin.dev", {
      from: presetsDir,
      extensions: [".mjs", ".ts"],
    })
  );
}
