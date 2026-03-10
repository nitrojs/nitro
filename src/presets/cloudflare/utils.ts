import type { Nitro, NitroRouteRules } from "nitropack/types";
import type { Plugin } from "rollup";
import type {
  WranglerConfig,
  CloudflarePagesRoutes,
  CloudflareHeaderTreeNode,
} from "./types";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, dirname, extname } from "node:path";
import { writeFile } from "nitropack/kit";
import { parseTOML, parseJSONC } from "confbox";
import { readGitConfig, readPackageJSON, findNearestFile } from "pkg-types";
import { defu } from "defu";
import { globby } from "globby";
import { provider } from "std-env";
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

function buildHeaderTree(rules: {
  [p: string]: NitroRouteRules;
}): CloudflareHeaderTreeNode {
  const tree: CloudflareHeaderTreeNode = {
    path: "/",
    wildcardHeaders: undefined,
    headers: undefined,
    children: {},
  };

  for (const [path, routeRules] of Object.entries(rules).filter(
    ([_, routeRules]) => routeRules.headers
  )) {
    const pathParts = path == "/" ? [] : path.slice(1).split("/");
    let currentNode = tree;
    for (const part of pathParts) {
      if (part === "**") break;

      currentNode.children[part] = currentNode.children[part] || {
        path: (currentNode.path == "/" ? "" : currentNode.path) + "/" + part,
        children: {},
      };
      currentNode = currentNode.children[part];
    }
    if (pathParts.at(-1) === "**") {
      currentNode.wildcardHeaders = routeRules.headers;
    } else {
      currentNode.headers = routeRules.headers;
    }
  }

  return tree;
}
function processHeaderValues(
  parentHeaders: Record<string, string>,
  headers: Record<string, string>
) {
  return Object.entries(headers)
    .filter(
      ([header, value]) =>
        !parentHeaders[header.toLowerCase()] ||
        parentHeaders[header.toLowerCase()] !== value
    )
    .map(([header, value]) => {
      const values = [`  ${header}: ${value}`];
      if (parentHeaders[header.toLowerCase()]) {
        values.unshift(`  ! ${header}`);
      }
      return values.join("\n");
    });
}
function processHeaderTree(
  baseURL: string,
  tree: CloudflareHeaderTreeNode,
  parentHeaders?: Record<string, Record<string, string>>
) {
  parentHeaders = parentHeaders || { "/": {} };
  let contents: string[] = [];

  let closestWildcard = tree.path;
  do {
    closestWildcard = closestWildcard.split("/").slice(0, -1).join("/") || "/";
  } while (closestWildcard !== "/" && !parentHeaders[closestWildcard]);

  if (tree.wildcardHeaders) {
    const path = joinURL(baseURL, (tree.path == "/" ? "" : tree.path) + "/*");
    const headers = processHeaderValues(
      parentHeaders[closestWildcard],
      tree.wildcardHeaders
    );

    if (headers.length > 0) {
      contents.push([path, ...headers].join("\n"));

      parentHeaders[tree.path] = {
        ...parentHeaders[closestWildcard],
        ...Object.fromEntries(
          Object.entries(tree.wildcardHeaders).map(([header, value]) => [
            header.toLowerCase(),
            value,
          ])
        ),
      };
    }
  }

  if (tree.headers) {
    const headers = processHeaderValues(
      parentHeaders[closestWildcard],
      tree.headers
    );
    if (headers.length > 0) {
      contents.push([joinURL(baseURL, tree.path), ...headers].join("\n"));
    }
  }

  for (const [_, child] of Object.entries(tree.children).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    contents = [
      ...contents,
      ...processHeaderTree(baseURL, child, parentHeaders),
    ];
  }

  return contents;
}

export async function writeCFHeaders(
  nitro: Nitro,
  outdir: "public" | "output"
) {
  const headersPath = join(
    outdir === "public"
      ? nitro.options.output.publicDir
      : nitro.options.output.dir,
    "_headers"
  );

  const contents = processHeaderTree(
    nitro.options.baseURL,
    buildHeaderTree(nitro.options.routeRules)
  );

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

export async function enableNodeCompat(nitro: Nitro) {
  nitro.options.cloudflare ??= {};

  // Enable deploy config for workers CI by default
  // TODO: enable this by default once API could assert no config overrides will happen
  if (
    nitro.options.cloudflare.deployConfig === undefined &&
    provider === "cloudflare_workers"
  ) {
    nitro.options.cloudflare.deployConfig = true;
  }

  // Infer nodeCompat from user config
  if (nitro.options.cloudflare.nodeCompat === undefined) {
    const { config } = await readWranglerConfig(nitro);
    const userCompatibilityFlags = new Set(config?.compatibility_flags || []);
    if (
      userCompatibilityFlags.has("nodejs_compat") ||
      userCompatibilityFlags.has("nodejs_compat_v2") ||
      nitro.options.cloudflare.deployConfig
    ) {
      nitro.options.cloudflare.nodeCompat = true;
    }
  }

  if (!nitro.options.cloudflare.nodeCompat) {
    if (nitro.options.cloudflare.nodeCompat === undefined) {
      nitro.logger.warn("[cloudflare] Node.js compatibility is not enabled.");
    }
    return;
  }

  nitro.options.unenv.push(unenvWorkerdWithNodeCompat);
  nitro.options.rollupConfig!.plugins ??= [];
  (nitro.options.rollupConfig!.plugins as Plugin[]).push(
    workerdHybridNodeCompatPlugin
  );
}

const extensionParsers = {
  ".json": JSON.parse,
  ".jsonc": parseJSONC,
  ".toml": parseTOML,
} as const;

async function readWranglerConfig(
  nitro: Nitro
): Promise<{ configPath?: string; config?: WranglerConfig }> {
  const configPath = await findNearestFile(
    ["wrangler.json", "wrangler.jsonc", "wrangler.toml"],
    {
      startingFrom: nitro.options.rootDir,
    }
  ).catch(() => undefined);
  if (!configPath) {
    return {};
  }
  const userConfigText = await readFile(configPath, "utf8");
  const parser =
    extensionParsers[extname(configPath) as keyof typeof extensionParsers];
  if (!parser) {
    /* unreachable */
    throw new Error(`Unsupported config file format: ${configPath}`);
  }
  const config = parser(userConfigText) as WranglerConfig;
  return { configPath, config };
}

// https://developers.cloudflare.com/workers/wrangler/configuration/#generated-wrangler-configuration
export async function writeWranglerConfig(
  nitro: Nitro,
  cfTarget: "pages" | "module"
) {
  // Skip if not enabled
  if (!nitro.options.cloudflare?.deployConfig) {
    return;
  }

  // Compute path to generated wrangler.json
  const wranglerConfigDir = nitro.options.output.serverDir;
  const wranglerConfigPath = join(wranglerConfigDir, "wrangler.json");

  // Default configs
  const defaults: WranglerConfig = {};

  // Config overrides
  const overrides: WranglerConfig = {};

  // Compatibility date
  defaults.compatibility_date =
    nitro.options.compatibilityDate.cloudflare ||
    nitro.options.compatibilityDate.default;

  if (cfTarget === "pages") {
    // Pages
    overrides.pages_build_output_dir = relative(
      wranglerConfigDir,
      nitro.options.output.dir
    );
  } else {
    // Modules
    overrides.main = relative(
      wranglerConfigDir,
      join(nitro.options.output.serverDir, "index.mjs")
    );
    overrides.assets = {
      binding: "ASSETS",
      directory: relative(
        wranglerConfigDir,
        resolve(
          nitro.options.output.publicDir,
          "..".repeat(nitro.options.baseURL.split("/").filter(Boolean).length)
        )
      ),
    };
  }

  // Read user config
  const { config: userConfig = {} } = await readWranglerConfig(nitro);

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

async function generateWorkerName(nitro: Nitro) {
  const gitConfig = await readGitConfig(nitro.options.rootDir).catch(
    () => undefined
  );
  const gitRepo = gitConfig?.remote?.origin?.url
    ?.replace(/\.git$/, "")
    .match(/[/:]([^/]+\/[^/]+)$/)?.[1];
  const pkgJSON = await readPackageJSON(nitro.options.rootDir).catch(
    () => undefined
  );
  const pkgName = pkgJSON?.name;
  const subpath = relative(nitro.options.workspaceDir, nitro.options.rootDir);
  return `${gitRepo || pkgName}/${subpath}`
    .toLowerCase()
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-$/, "");
}
