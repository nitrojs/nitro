import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, dirname } from "node:path";
import { writeFile } from "nitropack/kit";
import { parseTOML, stringifyTOML } from "confbox";
import defu from "defu";
import { globby } from "globby";
import type { Nitro } from "nitropack/types";
import { join, resolve } from "pathe";
import {
  joinURL,
  hasProtocol,
  withLeadingSlash,
  withTrailingSlash,
  withoutLeadingSlash,
} from "ufo";
import type { CloudflarePagesRoutes } from "./types";
import type { Config as WranglerConfig } from "./types.wrangler";

export async function writeCFPagesFiles(nitro: Nitro) {
  await writeCFRoutes(nitro);
  await writeCFPagesHeaders(nitro);
  await writeCFPagesRedirects(nitro);
  await writeCFWranglerConfig(nitro);
}

export async function writeCFPagesStaticFiles(nitro: Nitro) {
  await writeCFPagesHeaders(nitro);
  await writeCFPagesRedirects(nitro);
}

async function writeCFRoutes(nitro: Nitro) {
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

async function writeCFPagesHeaders(nitro: Nitro) {
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

async function writeCFPagesRedirects(nitro: Nitro) {
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

async function writeCFWranglerConfig(nitro: Nitro) {
  const extraConfig: WranglerConfig = nitro.options.cloudflare?.wrangler || {};

  // Skip if there are no extra config
  if (Object.keys(extraConfig || {}).length === 0) {
    return;
  }

  // Read user config
  const userConfig = await resolveWranglerConfig(nitro.options.rootDir);

  // Merge configs
  const mergedConfig = userConfig.config
    ? mergeWranglerConfig(userConfig.config, extraConfig)
    : extraConfig;

  // Explicitly fail if pages_build_output_dir is set
  if (mergedConfig.pages_build_output_dir) {
    throw new Error(
      "Custom wrangler `pages_build_output_dir` is not supported."
    );
  }

  // Write config
  // https://github.com/cloudflare/workers-sdk/pull/7442
  const configRedirect = !!process.env.EXPERIMENTAL_WRANGLER_CONFIG;
  if (configRedirect) {
    const configPath = join(
      nitro.options.rootDir,
      ".wrangler/deploy/config.json"
    );
    const wranglerConfigPath = join(
      nitro.options.output.serverDir,
      "wrangler.json"
    );
    await writeFile(
      configPath,
      JSON.stringify({
        configPath: relative(dirname(configPath), wranglerConfigPath),
      }),
      true
    );
    await writeFile(
      wranglerConfigPath,
      JSON.stringify(mergedConfig, null, 2),
      true
    );
  } else {
    // Overwrite user config (TODO: remove when cloudflare/workers-sdk#7442 is GA)
    const jsonConfig = join(nitro.options.rootDir, "wrangler.json");
    if (existsSync(jsonConfig)) {
      await writeFile(jsonConfig, JSON.stringify(mergedConfig, null, 2), true);
    } else {
      const tomlConfig = join(nitro.options.rootDir, "wrangler.toml");
      await writeFile(tomlConfig, stringifyTOML(mergedConfig), true);
    }
  }
}

async function resolveWranglerConfig(
  dir: string
): Promise<{ path: string; config?: WranglerConfig }> {
  const jsonConfig = join(dir, "wrangler.json");
  if (existsSync(jsonConfig)) {
    const config = JSON.parse(
      await readFile(join(dir, "wrangler.json"), "utf8")
    ) as WranglerConfig;
    return {
      config,
      path: jsonConfig,
    };
  }
  const tomlConfig = join(dir, "wrangler.toml");
  if (existsSync(tomlConfig)) {
    const config = parseTOML<WranglerConfig>(
      await readFile(join(dir, "wrangler.toml"), "utf8")
    );
    return {
      config,
      path: tomlConfig,
    };
  }
  return {
    path: tomlConfig,
  };
}

/**
 * Merge user config with extra config
 *
 * - Objects/Arrays are merged
 * - User config takes precedence over extra config
 */
function mergeWranglerConfig(
  userConfig: WranglerConfig = {},
  extraConfig: WranglerConfig = {}
): WranglerConfig {
  // TODO: Improve logic with explicit merging
  return defu(userConfig, extraConfig);
}
