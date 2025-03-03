import type { Nitro, RollupConfig } from "nitropack/types";
import type { Plugin } from "rollup";
import type { WranglerConfig, CloudflarePagesRoutes } from "./types";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, dirname } from "node:path";
import { writeFile } from "nitropack/kit";
import { parseTOML } from "confbox";
import { readGitConfig, readPackageJSON } from "pkg-types";
import { defu } from "defu";
import { globby } from "globby";
import { join, resolve } from "pathe";
import {
  joinURL,
  hasProtocol,
  withLeadingSlash,
  withTrailingSlash,
  withoutLeadingSlash,
} from "ufo";
import {
  workerdHybridNodeCompatPlugin,
  unenvWorkerdWithNodeCompat,
} from "../_unenv/preset-workerd";

export async function writeCFRoutes(nitro: Nitro) {
  const _cfPagesConfig = nitro.options.cloudflare?.pages || {};
  const routes: CloudflarePagesRoutes = {
    version: _cfPagesConfig.routes?.version || 1,
    include: _cfPagesConfig.routes?.include || ["/*"],
    exclude: _cfPagesConfig.routes?.exclude || [],
  };

  const writeRoutes = () =>
    writeFile(
      resolve(nitro.options.output.dir, "_routes.json"),
      JSON.stringify(routes, undefined, 2),
      true
    );

  if (_cfPagesConfig.defaultRoutes === false) {
    await writeRoutes();
    return;
  }

  // Exclude public assets from hitting the worker
  const explicitPublicAssets = nitro.options.publicAssets.filter(
    (dir, index, array) => {
      if (dir.fallthrough || !dir.baseURL) {
        return false;
      }

      const normalizedBase = withoutLeadingSlash(dir.baseURL);

      return !array.some(
        (otherDir, otherIndex) =>
          otherIndex !== index &&
          normalizedBase.startsWith(
            withoutLeadingSlash(withTrailingSlash(otherDir.baseURL))
          )
      );
    }
  );

  // Explicit prefixes
  routes.exclude!.push(
    ...explicitPublicAssets
      .map((asset) => joinURL(nitro.options.baseURL, asset.baseURL || "/", "*"))
      .sort(comparePaths)
  );

  // Unprefixed assets
  const publicAssetFiles = await globby("**", {
    cwd: nitro.options.output.dir,
    absolute: false,
    dot: true,
    ignore: [
      "_worker.js",
      "_worker.js.map",
      "nitro.json",
      ...routes.exclude!.map((path) =>
        withoutLeadingSlash(path.replace(/\/\*$/, "/**"))
      ),
    ],
  });
  // Remove index.html or the .html extension to support pages pre-rendering
  routes.exclude!.push(
    ...publicAssetFiles
      .map(
        (i) =>
          withLeadingSlash(i)
            .replace(/\/index\.html$/, "")
            .replace(/\.html$/, "") || "/"
      )
      .sort(comparePaths)
  );

  // Only allow 100 rules in total (include + exclude)
  routes.exclude!.splice(100 - routes.include!.length);

  await writeRoutes();
}

function comparePaths(a: string, b: string) {
  return a.split("/").length - b.split("/").length || a.localeCompare(b);
}

export async function writeCFPagesHeaders(nitro: Nitro) {
  const headersPath = join(nitro.options.output.dir, "_headers");
  const contents = [];

  const rules = Object.entries(nitro.options.routeRules).sort(
    (a, b) => b[0].split(/\/(?!\*)/).length - a[0].split(/\/(?!\*)/).length
  );

  for (const [path, routeRules] of rules.filter(
    ([_, routeRules]) => routeRules.headers
  )) {
    const headers = [
      joinURL(nitro.options.baseURL, path.replace("/**", "/*")),
      ...Object.entries({ ...routeRules.headers }).map(
        ([header, value]) => `  ${header}: ${value}`
      ),
    ].join("\n");

    contents.push(headers);
  }

  if (existsSync(headersPath)) {
    const currentHeaders = await readFile(headersPath, "utf8");
    if (/^\/\* /m.test(currentHeaders)) {
      nitro.logger.info(
        "Not adding Nitro fallback to `_headers` (as an existing fallback was found)."
      );
      return;
    }
    nitro.logger.info(
      "Adding Nitro fallback to `_headers` to handle all unmatched routes."
    );
    contents.unshift(currentHeaders);
  }

  await writeFile(headersPath, contents.join("\n"), true);
}

export async function writeCFPagesRedirects(nitro: Nitro) {
  const redirectsPath = join(nitro.options.output.dir, "_redirects");
  const staticFallback = existsSync(
    join(nitro.options.output.publicDir, "404.html")
  )
    ? `${joinURL(nitro.options.baseURL, "/*")} ${joinURL(nitro.options.baseURL, "/404.html")} 404`
    : "";
  const contents = [staticFallback];
  const rules = Object.entries(nitro.options.routeRules).sort(
    (a, b) => a[0].split(/\/(?!\*)/).length - b[0].split(/\/(?!\*)/).length
  );

  for (const [key, routeRules] of rules.filter(
    ([_, routeRules]) => routeRules.redirect
  )) {
    const code = routeRules.redirect!.statusCode;
    const from = joinURL(nitro.options.baseURL, key.replace("/**", "/*"));
    const to = hasProtocol(routeRules.redirect!.to, { acceptRelative: true })
      ? routeRules.redirect!.to
      : joinURL(nitro.options.baseURL, routeRules.redirect!.to);
    contents.unshift(`${from}\t${to}\t${code}`);
  }

  if (existsSync(redirectsPath)) {
    const currentRedirects = await readFile(redirectsPath, "utf8");
    if (/^\/\* /m.test(currentRedirects)) {
      nitro.logger.info(
        "Not adding Nitro fallback to `_redirects` (as an existing fallback was found)."
      );
      return;
    }
    nitro.logger.info(
      "Adding Nitro fallback to `_redirects` to handle all unmatched routes."
    );
    contents.unshift(currentRedirects);
  }

  await writeFile(redirectsPath, contents.join("\n"), true);
}

const wranglerConfigAndUnenv2CompatDate = "2025-03-01";

export async function enableNodeCompat(nitro: Nitro) {
  const compatDate =
    nitro.options.compatibilityDate.cloudflare ||
    nitro.options.compatibilityDate.default;

  const nodeCompatEnabled: boolean =
    nitro.options.cloudflare?.nodeCompat ??
    compatDate >= wranglerConfigAndUnenv2CompatDate;

  if (
    compatDate < wranglerConfigAndUnenv2CompatDate &&
    nitro.options.cloudflare?.nodeCompat === undefined
  ) {
    nitro.logger.warn(
      `Current compatibility date "${compatDate}" does not supports native Node.js support in cloudflare workers. Please consider upgrading compatibilityDate to "${wranglerConfigAndUnenv2CompatDate}" or newer.`
    );
  }

  if (nodeCompatEnabled) {
    nitro.options.unenv.push(unenvWorkerdWithNodeCompat);
    nitro.options.rollupConfig!.plugins ??= [];
    (nitro.options.rollupConfig!.plugins as Plugin[]).push(
      workerdHybridNodeCompatPlugin
    );
  }

  nitro.options.cloudflare ??= {};
  nitro.options.cloudflare.nodeCompat = nodeCompatEnabled;
}

// https://developers.cloudflare.com/workers/wrangler/configuration/#generated-wrangler-configuration
export async function writeWranglerConfig(
  nitro: Nitro,
  cfTarget: "pages" | "module"
) {
  // Compute path to generated wrangler.json
  const wranglerConfigDir = nitro.options.output.serverDir;
  const wranglerConfigPath = join(wranglerConfigDir, "wrangler.json");

  // Default configs
  const defaults: WranglerConfig = {};

  // Config overrides
  const overrides: WranglerConfig = {};

  // Compatibility date
  const compatDate = (defaults.compatibility_date =
    nitro.options.compatibilityDate.cloudflare ||
    nitro.options.compatibilityDate.default);

  if (cfTarget === "pages") {
    // Pages
    overrides.pages_build_output_dir = relative(
      wranglerConfigDir,
      nitro.options.output.publicDir
    );
  } else {
    // Modules
    overrides.main = relative(
      wranglerConfigDir,
      join(nitro.options.output.serverDir, "index.mjs")
    );
    overrides.assets = {
      binding: "ASSETS",
      directory: relative(wranglerConfigDir, nitro.options.output.publicDir),
    };
  }

  // Read user config
  const userConfig = await resolveWranglerConfig(nitro.options.rootDir);

  // Nitro context config (from frameworks and modules)
  const ctxConfig = nitro.options.cloudflare?.wrangler || {};

  // Validate and warn about overrides
  for (const key in overrides) {
    if (key in userConfig || key in ctxConfig) {
      nitro.logger.warn(
        `[cloudflare] Wrangler config \`${key}\`${key in ctxConfig ? "set by config or modules" : ""} is overridden and will be ignored.`
      );
    }
  }

  // (first argument takes precedence)
  const wranglerConfig = defu(
    overrides,
    ctxConfig,
    userConfig,
    defaults
  ) as WranglerConfig;

  // Name is required
  if (!wranglerConfig.name) {
    wranglerConfig.name = await generateWorkerName(nitro)!;
    nitro.logger.info(
      `Using auto generated worker name: \`${wranglerConfig.name}\``
    );
  }

  // Compatibility flags
  // prettier-ignore
  const compatFlags = new Set(wranglerConfig.compatibility_flags || [])
  if (nitro.options.cloudflare?.nodeCompat) {
    if (
      compatFlags.has("nodejs_compat_v2") &&
      compatFlags.has("no_nodejs_compat_v2")
    ) {
      nitro.logger.warn(
        "[cloudflare] Wrangler config `compatibility_flags` contains both `nodejs_compat_v2` and `no_nodejs_compat_v2`. Ignoring `nodejs_compat_v2`."
      );
      compatFlags.delete("nodejs_compat_v2");
    }
    if (compatFlags.has("nodejs_compat_v2")) {
      nitro.logger.warn(
        "[cloudflare] Please consider replacing `nodejs_compat_v2` with `nodejs_compat` in your `compatibility_flags` or USE IT AT YOUR OWN RISK as it can cause issues with nitro."
      );
    } else {
      // Add default compatibility flags
      compatFlags.add("nodejs_compat");
      compatFlags.add("no_nodejs_compat_v2");
    }
  }
  wranglerConfig.compatibility_flags = [...compatFlags];

  // Write wrangler.json
  await writeFile(
    wranglerConfigPath,
    JSON.stringify(wranglerConfig, null, 2),
    true
  );

  // Write .wrangler/deploy/config.json (redirect file)
  let shouldWriteWranglerDeployConfig =
    compatDate >= wranglerConfigAndUnenv2CompatDate;
  if (nitro.options.cloudflare?.noWranglerDeployConfig) {
    shouldWriteWranglerDeployConfig = false;
  }
  if (shouldWriteWranglerDeployConfig) {
    const configPath = join(
      nitro.options.rootDir,
      ".wrangler/deploy/config.json"
    );
    await writeFile(
      configPath,
      JSON.stringify({
        configPath: relative(dirname(configPath), wranglerConfigPath),
      }),
      true
    );
  }
}

async function resolveWranglerConfig(dir: string): Promise<WranglerConfig> {
  const jsonConfig = join(dir, "wrangler.json");
  if (existsSync(jsonConfig)) {
    const config = JSON.parse(
      await readFile(join(dir, "wrangler.json"), "utf8")
    ) as WranglerConfig;
    return config;
  }
  const tomlConfig = join(dir, "wrangler.toml");
  if (existsSync(tomlConfig)) {
    const config = parseTOML<WranglerConfig>(
      await readFile(join(dir, "wrangler.toml"), "utf8")
    );
    return config;
  }
  return {};
}

async function generateWorkerName(nitro: Nitro) {
  const gitConfig = await readGitConfig(nitro.options.rootDir).catch(() => {});
  const gitRepo = gitConfig?.remote?.origin?.url
    ?.replace(/\.git$/, "")
    .match(/[/:]([^/]+\/[^/]+)$/)?.[1];
  const pkgJSON = await readPackageJSON(nitro.options.rootDir).catch(() => {});
  const pkgName = pkgJSON?.name;
  const subpath = relative(nitro.options.workspaceDir, nitro.options.rootDir);
  return `${gitRepo || pkgName}/${subpath}`.replace(/[^a-zA-Z0-9-]/g, "-");
}
