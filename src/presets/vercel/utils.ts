import fsp from "node:fs/promises";
import { constants } from "node:fs";
import { defu } from "defu";
import mime from "mime";
import { writeFile } from "../_utils/fs.ts";
import type {
  Nitro,
  NormalizedRouteRules,
  PrerenderRoute,
  ProxyRuleOptions,
  PublicAssetDir,
  RedirectRuleOptions,
} from "nitro/types";
import { basename, dirname, relative, resolve } from "pathe";
import { readPackageJSON } from "pkg-types";
import {
  addRoute,
  compareRoutes,
  createRouter,
  findOverlappingRoutes,
  routeToRegExp,
  type RouterContext,
} from "rou3";
import { escapeRegExp } from "../../utils/regex.ts";
import { getPublicAssetCorsHeaders } from "../_utils/cors.ts";
import { catchAllRef, hasHeaders, parseRouteKey, sortRoutes } from "../_utils/routes.ts";
import { joinURL, withLeadingSlash, withoutLeadingSlash } from "ufo";
import type {
  PrerenderFunctionConfig,
  VercelBuildConfigV3,
  VercelServerlessFunctionConfig,
} from "./types.ts";
import { ISR_URL_PARAM } from "./runtime/isr.ts";

// https://vercel.com/docs/build-output-api/configuration

// https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
const SUPPORTED_NODE_VERSIONS = [22, 24];

// h3 ProxyOptions that Vercel CDN rewrites cannot handle at the edge.
// https://vercel.com/docs/rewrites
const UNSUPPORTED_PROXY_OPTIONS = [
  "headers", // headers added to the outgoing request to the upstream
  "forwardHeaders",
  "filterHeaders",
  "fetchOptions",
  "cookieDomainRewrite",
  "cookiePathRewrite",
  "onResponse",
] as const;

const FALLBACK_ROUTE = "/__server";

const ISR_SUFFIX = "-isr"; // Avoid using . as it can conflict with routing

const SAFE_FS_CHAR_RE = /[^a-zA-Z0-9_.[\]/]/g;

// Vercel serves `<dir>/index.html` (and extensionless `<dir>/index`) at `<dir>`
// using built-in directory indexes.
const INDEX_FILE_RE = /(^|\/)index(\.html)?$/;

const SURROUNDING_SLASH_RE = /^\/+|\/+$/g;

// `Cache-Control: max-age` for a non-fallthrough public asset directory that
// does not set its own `maxAge`. Such assets are assumed to be immutable, since
// a missing one 404s rather than reaching the server. Opt out with `maxAge: 0`,
// or set a custom header with a `cache-control` route rule for the base.
const DEFAULT_PUBLIC_ASSET_MAX_AGE = 31_536_000; // 1 year

function getSystemNodeVersion() {
  const systemNodeVersion = Number.parseInt(process.versions.node.split(".")[0]);

  return Number.isNaN(systemNodeVersion) ? 22 : systemNodeVersion;
}

export async function generateFunctionFiles(nitro: Nitro) {
  const o11Routes = getObservabilityRoutes(nitro);

  const buildConfigPath = resolve(nitro.options.output.dir, "config.json");
  const buildConfig = generateBuildConfig(nitro, o11Routes);
  await writeFile(buildConfigPath, JSON.stringify(buildConfig, null, 2));

  const baseFunctionConfig: VercelServerlessFunctionConfig = {
    handler: "index.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    supportsResponseStreaming: true,
    ...(nitro.options.sourcemap ? { shouldAddSourcemapSupport: true } : {}),
    ...nitro.options.vercel?.functions,
  };

  if (
    Array.isArray(baseFunctionConfig.experimentalTriggers) &&
    baseFunctionConfig.experimentalTriggers.length > 0
  ) {
    nitro.logger.warn(
      "`experimentalTriggers` on the base `vercel.functions` config applies to the catch-all function and is likely not what you want. " +
        "Routes with queue triggers are not accessible on the web. " +
        "Use `vercel.functionRules` to attach triggers to specific routes instead."
    );
  }

  const functionConfigPath = resolve(nitro.options.output.serverDir, ".vc-config.json");
  await writeFile(functionConfigPath, JSON.stringify(baseFunctionConfig, null, 2));

  const functionRules = nitro.options.vercel?.functionRules;
  const hasRouteFunctionConfig = functionRules && Object.keys(functionRules).length > 0;
  const routeFuncRouter = hasRouteFunctionConfig ? createPatternRouter(functionRules) : undefined;

  // Write ISR functions
  const isrFuncDirs = new Set<string>();
  for (const [key, value] of Object.entries(nitro.options.routeRules)) {
    if (!value.isr) {
      continue;
    }

    const funcPrefix = resolve(
      nitro.options.output.serverDir,
      "..",
      normalizeRouteDest(key) + ISR_SUFFIX
    );
    await fsp.mkdir(dirname(funcPrefix), { recursive: true });

    const matchData = routeFuncRouter && matchPattern(routeFuncRouter, key).at(-1);
    if (matchData) {
      isrFuncDirs.add(
        resolve(nitro.options.output.serverDir, "..", normalizeRouteDest(key) + ".func")
      );
      await createFunctionDirWithCustomConfig(
        funcPrefix + ".func",
        nitro.options.output.serverDir,
        baseFunctionConfig,
        matchData,
        normalizeRouteDest(key) + ISR_SUFFIX
      );
    } else {
      await fsp.symlink(
        "./" + relative(dirname(funcPrefix), nitro.options.output.serverDir),
        funcPrefix + ".func",
        "junction"
      );
    }

    await writePrerenderConfig(
      funcPrefix + ".prerender-config.json",
      value.isr,
      nitro.options.vercel?.config?.bypassToken
    );
  }

  // Write functionRules custom function directories
  const createdFuncDirs = new Set<string>();
  if (hasRouteFunctionConfig) {
    for (const [pattern, overrides] of Object.entries(functionRules!)) {
      const funcDir = resolve(
        nitro.options.output.serverDir,
        "..",
        normalizeRouteDest(pattern) + ".func"
      );
      // Skip if ISR already created a custom config function for this route
      if (isrFuncDirs.has(funcDir)) {
        continue;
      }
      await createFunctionDirWithCustomConfig(
        funcDir,
        nitro.options.output.serverDir,
        baseFunctionConfig,
        overrides,
        normalizeRouteDest(pattern)
      );
      createdFuncDirs.add(funcDir);
    }
  }

  // Write observability routes
  if (o11Routes.length === 0) {
    return;
  }
  for (const route of o11Routes) {
    const funcPrefix = resolve(nitro.options.output.serverDir, "..", route.dest);
    const funcDir = funcPrefix + ".func";

    // Skip if already created by functionRules
    if (createdFuncDirs.has(funcDir)) {
      continue;
    }

    const matchData = routeFuncRouter && matchPattern(routeFuncRouter, route.route).at(-1);
    if (matchData) {
      await createFunctionDirWithCustomConfig(
        funcDir,
        nitro.options.output.serverDir,
        baseFunctionConfig,
        matchData,
        route.dest
      );
    } else {
      await fsp.mkdir(dirname(funcPrefix), { recursive: true });
      await fsp.symlink(
        "./" + relative(dirname(funcPrefix), nitro.options.output.serverDir),
        funcDir,
        "junction"
      );
    }
  }
}

export async function generateStaticFiles(nitro: Nitro) {
  const buildConfigPath = resolve(nitro.options.output.dir, "config.json");
  const buildConfig = generateBuildConfig(nitro);
  await writeFile(buildConfigPath, JSON.stringify(buildConfig, null, 2));
}

function generateBuildConfig(nitro: Nitro, o11Routes?: ObservabilityRoute[]) {
  const rules = sortRoutes(Object.keys(nitro.options.routeRules)).map(
    (path) => [path, nitro.options.routeRules[path]] as [string, NormalizedRouteRules]
  );

  // Route rule keys and handler routes are relative to the baseURL, as at runtime
  const routeSrc = (route: string) => routeToRegExp(joinURL(nitro.options.baseURL, route));

  // Determine which proxy rules can be offloaded to Vercel CDN rewrites
  const cdnProxyPaths = new Set(
    rules
      .filter(([_, routeRules]) => routeRules.proxy && canUseVercelRewrite(routeRules.proxy))
      .map(([path]) => path)
  );

  // `redirect: false` paths opt out of broader CDN redirects
  const optOuts = rules
    .filter(([_, routeRules]) => routeRules.redirect === false)
    .map(([path]) => parseRouteKey(path));

  // Determine which redirect rules can be offloaded to Vercel CDN redirects,
  // and the opted out paths to keep out of each
  const cdnRedirectPaths = new Map<string, string[]>();
  for (const [path, routeRules] of rules) {
    if (
      !routeRules.redirect ||
      cdnProxyPaths.has(path) ||
      hasQueryWildcard(routeRules.redirect.to)
    ) {
      continue;
    }
    const optOutPaths = getOptOutPaths(parseRouteKey(path), optOuts);
    if (optOutPaths) {
      cdnRedirectPaths.set(path, optOutPaths);
    }
  }

  const publicAssetRoutes = getPublicAssetRoutes(nitro.options.publicAssets, {
    baseURL: nitro.options.baseURL,
    routeRules: nitro.options.routeRules,
  });

  const config = defu(nitro.options.vercel?.config, {
    version: 3,
    framework: {
      name: nitro.options.framework.name,
      version: nitro.options.framework.version,
    },
    overrides: getPrerenderOverrides(nitro._prerenderedRoutes),
    routes: [
      // Header-only rules (least specific first, so more specific headers override on `continue`)
      ...rules
        .filter(
          ([path, routeRules]) =>
            hasHeaders(routeRules) && !cdnRedirectPaths.has(path) && !cdnProxyPaths.has(path)
        )
        .reverse()
        .map(([path, routeRules]) => {
          const { path: route, methods } = parseRouteKey(path);
          return {
            src: routeSrc(route).source,
            ...(methods && { methods }),
            headers: routeRules.headers,
            continue: true,
          };
        }),
      // CORS headers of public asset dirs, which the server function does not serve
      ...getPublicAssetCorsHeaders(nitro).map(({ base, headers }) => ({
        src: joinURL(escapeRegExp(joinURL(nitro.options.baseURL, base)), "(.*)"),
        headers,
        continue: true,
      })),
      // Redirect and proxy rules (most specific first)
      // Rules left to the server function stop routing so that less specific
      // rules below cannot match.
      // https://vercel.com/docs/rewrites
      ...rules.flatMap(([path, routeRules]) => {
        const { path: pattern, methods } = parseRouteKey(path);
        const src = routeSrc(pattern);
        if (cdnProxyPaths.has(path)) {
          const route: Record<string, any> = {
            src: src.source,
            ...(methods && { methods }),
            dest: (routeRules.proxy as ProxyRuleOptions).to.replaceAll("**", catchAllRef(src)),
          };
          if (hasHeaders(routeRules)) {
            route.headers = routeRules.headers;
          }
          return [route];
        }
        const optOutPaths = cdnRedirectPaths.get(path);
        if (optOutPaths) {
          const redirect = routeRules.redirect as RedirectRuleOptions;
          let route = {
            src: excludePaths(src, optOutPaths.map(routeSrc)),
            ...(methods && { methods }),
            status: redirect.status,
            headers: {
              Location: redirect.to.replaceAll("**", catchAllRef(src)),
            },
          };
          if (hasHeaders(routeRules)) {
            route = defu(route, { headers: routeRules.headers });
          }
          return [route];
        }
        return routeRules.redirect || routeRules.proxy
          ? [{ src: src.source, ...(methods && { methods }) }]
          : [];
      }),
      // Skew protection
      ...(nitro.options.vercel?.skewProtection && nitro.options.manifest?.deploymentId
        ? [
            {
              src: "/.*",
              has: [
                {
                  type: "header",
                  key: "Sec-Fetch-Dest",
                  value: "document",
                },
              ],
              headers: {
                "Set-Cookie": `__vdpl=${nitro.options.manifest.deploymentId}; Path=${nitro.options.baseURL}; SameSite=Lax; Secure; HttpOnly`,
              },
              continue: true,
            },
          ]
        : []),
      // Public asset rules
      ...publicAssetRoutes
        .filter((route) => route.cacheControl)
        .map(({ src, cacheControl }) => ({
          src,
          headers: {
            "cache-control": cacheControl!,
          },
          continue: true,
        })),
      { handle: "filesystem" },
      // Missing public assets must not fall through to the server function,
      // which would serve dynamic content under the immutable header above.
      // `no-store` keeps that header off this 404.
      ...publicAssetRoutes.map(({ src }) => ({
        src,
        status: 404,
        headers: {
          "cache-control": "no-store",
        },
        continue: false,
      })),
    ],
  } as VercelBuildConfigV3);

  // Cron jobs from scheduledTasks
  if (
    nitro.options.experimental.tasks &&
    Object.keys(nitro.options.scheduledTasks || {}).length > 0
  ) {
    const cronPath = nitro.options.vercel!.cronHandlerRoute || "/_vercel/cron";
    const cronEntries = Object.keys(nitro.options.scheduledTasks).map((schedule) => ({
      path: cronPath,
      schedule,
    }));
    config.crons = [...cronEntries, ...(config.crons || [])];
  }

  // Early return if we are building a static site
  if (nitro.options.static) {
    return config;
  }

  config.routes!.push(
    // ISR rules
    ...rules
      .filter(([_, value]) => value.isr !== undefined)
      .map(([key, value]) => {
        const src = `^(?<${ISR_URL_PARAM}>${routeSrc(key).source.slice(1, -1)})$`;
        if (value.isr === false) {
          // We need to write a rule to avoid route being shadowed by another cache rule elsewhere
          return {
            src,
            dest: FALLBACK_ROUTE,
          };
        }
        return {
          src,
          dest: withLeadingSlash(
            normalizeRouteDest(key) + ISR_SUFFIX + `?${ISR_URL_PARAM}=$${ISR_URL_PARAM}`
          ),
        };
      }),
    // Route function config routes
    ...(nitro.options.vercel?.functionRules
      ? sortRoutes(Object.keys(nitro.options.vercel.functionRules)).map((pattern) => ({
          src: routeSrc(pattern).source,
          dest: withLeadingSlash(normalizeRouteDest(pattern)),
        }))
      : []),
    // Observability routes
    ...(o11Routes || []).map((route) => ({
      src: routeSrc(route.route).source,
      dest: withLeadingSlash(route.dest),
    })),
    // If we are using an ISR function as a fallback
    // then we do not need to output the below fallback route as well
    ...(nitro.options.routeRules["/**"]?.isr
      ? []
      : [
          {
            src: "/(.*)",
            dest: FALLBACK_ROUTE,
          },
        ])
  );

  return config;
}

/**
 * Routes matching every public asset directory that Vercel serves from the
 * filesystem instead of falling through to the server function.
 *
 * The root base is excluded to mirror the runtime, which never treats `/` as a
 * public asset base (see `publicAssetBases`): a `/(.*)` source would otherwise
 * cache-control every response and, worse, 404 every dynamic route.
 *
 * Sources are joined with a slash (`/build/(.*)`, not `/build(.*)`) so a
 * sibling path such as `/buildings` is not matched, and escaped so that a base
 * containing regular expression characters stays literal.
 *
 * `cacheControl` is unset when a route rule already sets the header for the
 * base, which is the case for any directory with a positive `maxAge` (see
 * `resolveAssetsOptions`). Emitting it again would duplicate the rule that is
 * generated from route rules earlier in the routes array, and setting it here
 * would have no effect anyway: the first match wins.
 *
 * It is also unset for an explicit `maxAge: 0`, which opts the directory out of
 * the one-year default. Only a directory that never set a `maxAge` gets it.
 */
export function getPublicAssetRoutes(
  publicAssets: PublicAssetDir[],
  opts: { baseURL: string; routeRules: Record<string, NormalizedRouteRules> }
): { src: string; cacheControl?: string }[] {
  const routes: { src: string; cacheControl?: string }[] = [];
  for (const asset of publicAssets) {
    const assetBase = asset.baseURL || "/";
    if (asset.fallthrough || assetBase === "/") {
      continue;
    }
    const maxAge = asset.maxAge ?? DEFAULT_PUBLIC_ASSET_MAX_AGE;
    routes.push({
      src: joinURL(escapeRegExp(joinURL(opts.baseURL, assetBase)), "(.*)"),
      cacheControl:
        maxAge > 0 && !hasCacheControl(opts.routeRules[`${assetBase}/**`])
          ? `public, max-age=${maxAge}, immutable`
          : undefined,
    });
  }
  return routes;
}

/**
 * Map prerendered files to the route and content type they should be served with.
 *
 * Paths are always slash-free: Vercel strips slashes when matching, so a path
 * that keeps a trailing slash matches nothing at all (#4392), and the root
 * route has to map to an empty path (ufo's slash helpers cannot produce one).
 *
 * Files that Vercel already serves at the route using its built-in directory
 * indexes keep their path, and only get an entry when their content type
 * cannot be inferred from the file name.
 */
export function getPrerenderOverrides(prerenderedRoutes: PrerenderRoute[] = []) {
  const overrides: Record<string, { path?: string; contentType?: string }> = {};

  for (const { route, fileName, contentType } of prerenderedRoutes) {
    if (!fileName) {
      continue;
    }
    const file = withoutLeadingSlash(fileName);
    const path = route.replace(SURROUNDING_SLASH_RE, "");
    const override: { path?: string; contentType?: string } = {};

    // Only re-key when Vercel does not already serve the file at `path`: it
    // serves `<dir>/index.*` at `<dir>` via its built-in directory index, and
    // re-keying a file onto its own path would delete it, since Vercel drops
    // the original entry.
    if (file !== path && file.replace(INDEX_FILE_RE, "") !== path) {
      override.path = path;
    }

    // Vercel infers the content type from the file name, which has no
    // extension to go on for a non-HTML route ending in `/` (`/data/` is
    // prerendered to `data/index`) and would be served as a download.
    if (contentType && !mime.getType(file)) {
      override.contentType = contentType;
    }

    if (override.path !== undefined || override.contentType) {
      overrides[file] = override;
    }
  }

  return overrides;
}

// --- vercel.json ---

// https://vercel.com/docs/project-configuration
// https://openapi.vercel.sh/vercel.json
export interface VercelConfig {
  bunVersion?: string;
}

export async function resolveVercelRuntime(nitro: Nitro) {
  // 1. Respect explicit runtime from nitro config
  let runtime: VercelServerlessFunctionConfig["runtime"] = nitro.options.vercel?.functions?.runtime;

  if (runtime) {
    // Already specified
    return runtime;
  }

  const engines = (await readPackageJSON(nitro.options.rootDir).catch(() => undefined))?.engines;
  const vercelConfig = await readVercelConfig(nitro.options.rootDir);

  // 2. engines in package.json, 3. bunVersion in vercel.json, 4. runtime used to build.
  // Same precedence as Vercel: with both engines set, bun also needs bunVersion.
  const useBun = engines?.node
    ? !!(engines.bun && vercelConfig.bunVersion)
    : !!(engines?.bun || vercelConfig.bunVersion || "Bun" in globalThis);

  if (useBun) {
    runtime = await getEnginesBunRuntime(engines?.bun || vercelConfig.bunVersion || "1.x", {
      source: engines?.bun ? "`engines.bun` in `package.json`" : "`bunVersion` in `vercel.json`",
    });
  } else {
    if (engines?.node && (engines.bun || vercelConfig.bunVersion)) {
      nitro.logger.warn(
        "Using Node.js because `engines.node` is set in `package.json`. To use Bun, set both `engines.bun` in `package.json` and `bunVersion` in `vercel.json`."
      );
    }

    // Newest supported Node.js version allowed by engines.node
    let usedNodeVersion = engines?.node ? await getEnginesNodeVersion(engines.node) : undefined;
    if (engines?.node && !usedNodeVersion) {
      nitro.logger.warn(
        `\`engines.node\` (\`${engines.node}\`) in \`package.json\` does not match a supported Vercel Node.js version (${SUPPORTED_NODE_VERSIONS.join(", ")}). Using the Node.js version of the build instead.`
      );
    }

    // Auto-detect runtime based on system Node.js version
    if (!usedNodeVersion) {
      const systemNodeVersion = getSystemNodeVersion();
      usedNodeVersion =
        SUPPORTED_NODE_VERSIONS.find((version) => version >= systemNodeVersion) ??
        SUPPORTED_NODE_VERSIONS.at(-1);
    }
    runtime = `nodejs${usedNodeVersion}.x`;
  }

  // Synchronize back to nitro config
  nitro.options.vercel ??= {} as any;
  nitro.options.vercel!.functions ??= {} as any;
  nitro.options.vercel!.functions!.runtime = runtime;

  return runtime;
}

export async function readVercelConfig(rootDir: string): Promise<VercelConfig> {
  const vercelConfigPath = resolve(rootDir, "vercel.json");
  const vercelConfig = await fsp
    .readFile(vercelConfigPath)
    .then((config) => JSON.parse(config.toString()))
    .catch(() => ({}));
  return vercelConfig as VercelConfig;
}

/**
 * Check if a proxy rule can be offloaded to a Vercel CDN rewrite.
 * A proxy is eligible when it targets an external URL and uses no
 * ProxyOptions that Vercel's routing layer cannot handle at the edge.
 */
function canUseVercelRewrite(proxy: NormalizedRouteRules["proxy"]): proxy is { to: string } {
  if (!proxy || !proxy.to) {
    return false;
  }
  // Must be an external URL
  if (!/^https?:\/\//.test(proxy.to.replace(/\/\*\*$/, ""))) {
    return false;
  }
  if (hasQueryWildcard(proxy.to)) {
    return false;
  }
  // Must not use any ProxyOptions unsupported by Vercel rewrites
  for (const key of UNSUPPORTED_PROXY_OPTIONS) {
    if ((proxy as any)[key] !== undefined) {
      return false;
    }
  }
  return true;
}

// --- utils for observability ---

type ObservabilityRoute = {
  route: string; // route pattern
  dest: string; // function name
};

export function getObservabilityRoutes(nitro: Nitro): ObservabilityRoute[] {
  // Vercel resolves functions and static files from a single path to output
  // map that functions are added to last, so a function at the path of a
  // prerendered file hides that file and serves the route with SSR on every
  // request (#4242).
  const prerenderedPaths = new Set(
    (nitro._prerenderedRoutes || [])
      .filter((route) => route.fileName)
      .map((route) => route.route.replace(SURROUNDING_SLASH_RE, ""))
  );

  // ISR routes are served by their ISR function, so they need neither an
  // observability function nor a `config.json` route (#3563, #4447).
  const routeRulesRouter = createPatternRouter(nitro.options.routeRules);
  const hasISR = (route: string) =>
    (defu({}, ...matchPattern(routeRulesRouter, route).reverse()) as NormalizedRouteRules).isr;

  const routePatterns = [
    ...new Set([
      ...(nitro.options.ssrRoutes || []),
      ...[...nitro.scannedHandlers, ...nitro.options.handlers]
        .filter((h) => !h.middleware && h.route)
        .map((h) => h.route!),
    ]),
  ].filter(
    (route) => !prerenderedPaths.has(route.replace(SURROUNDING_SLASH_RE, "")) && !hasISR(route)
  );

  return sortRoutes(routePatterns).map((route) => ({
    route,
    dest: normalizeRouteDest(route),
  }));
}

// Output is a destination pathname to function name
function normalizeRouteDest(route: string) {
  return (
    route
      .split("/")
      .slice(1)
      .map((segment) => {
        if (segment.startsWith("**")) {
          return `[...${segment.replace(/[*:]/g, "")}]`;
        }
        const catchAll = segment.match(/^:(\w+)\(\.\*\)$/);
        if (catchAll) {
          return `[...${catchAll[1]}]`;
        }
        if (segment === "*") {
          return "[...]";
        }
        if (segment.startsWith(":")) {
          return `[${segment.slice(1)}]`;
        }
        if (segment.includes(":")) {
          return `[${segment.replace(/:/g, "_")}]`;
        }
        return segment;
      })
      // Only use filesystem-safe characters
      .map((segment) => segment.replace(SAFE_FS_CHAR_RE, "-"))
      .join("/") || "index"
  );
}

/**
 * Encodes a function path into a consumer name for queue/v2beta triggers.
 * Mirrors the encoding from @vercel/build-utils sanitizeConsumerName().
 * @see https://github.com/vercel/vercel/blob/main/packages/build-utils/src/lambda.ts
 */
function sanitizeConsumerName(functionPath: string): string {
  let result = "";
  for (const char of functionPath) {
    if (char === "_") {
      result += "__";
    } else if (char === "/") {
      result += "_S";
    } else if (char === ".") {
      result += "_D";
    } else if (/[A-Za-z0-9-]/.test(char)) {
      result += char;
    } else {
      result += "_" + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return result;
}

async function createFunctionDirWithCustomConfig(
  funcDir: string,
  serverDir: string,
  baseFunctionConfig: VercelServerlessFunctionConfig,
  overrides: VercelServerlessFunctionConfig,
  functionPath: string
) {
  await fsp.cp(serverDir, funcDir, {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
    verbatimSymlinks: true,
    filter: (src) => basename(src) !== ".vc-config.json",
  });
  const mergedConfig = defu(overrides, baseFunctionConfig);
  for (const [key, value] of Object.entries(overrides)) {
    if (Array.isArray(value)) {
      (mergedConfig as Record<string, unknown>)[key] = value;
    }
  }

  // Auto-derive consumer for queue/v2beta triggers
  const triggers = mergedConfig.experimentalTriggers;
  if (Array.isArray(triggers)) {
    for (const trigger of triggers as Array<Record<string, unknown>>) {
      if (trigger.type === "queue/v2beta" && !trigger.consumer) {
        trigger.consumer = sanitizeConsumerName(functionPath);
      }
    }
  }

  await writeFile(resolve(funcDir, ".vc-config.json"), JSON.stringify(mergedConfig, null, 2));
}

async function writePrerenderConfig(
  filename: string,
  isrConfig: NormalizedRouteRules["isr"],
  bypassToken?: string
) {
  // Normalize route rule
  if (typeof isrConfig === "number") {
    isrConfig = { expiration: isrConfig };
  } else if (isrConfig === true) {
    isrConfig = { expiration: false };
  } else {
    isrConfig = { ...isrConfig };
  }

  // Generate prerender config
  const prerenderConfig: PrerenderFunctionConfig = {
    expiration: isrConfig.expiration ?? false,
    bypassToken,
    ...isrConfig,
  };

  // Vercel only forwards the query string to the function with `passQuery`.
  // Without it, every `allowQuery` cache entry is rendered without its query
  // params (#4408). Decide on the user's list, before `__isr_route` is added.
  if (prerenderConfig.allowQuery?.length && prerenderConfig.passQuery === undefined) {
    prerenderConfig.passQuery = true;
  }

  if (prerenderConfig.allowQuery && !prerenderConfig.allowQuery.includes(ISR_URL_PARAM)) {
    prerenderConfig.allowQuery = [...prerenderConfig.allowQuery, ISR_URL_PARAM];
  }

  await writeFile(filename, JSON.stringify(prerenderConfig, null, 2));
}

function hasCacheControl(routeRules: NormalizedRouteRules | undefined): boolean {
  return Object.keys(routeRules?.headers || {}).some(
    (header) => header.toLowerCase() === "cache-control"
  );
}

// --- rou3 pattern utils ---

/**
 * A router looked up with route *patterns* (a `routeRules` key, a handler
 * route), not with request paths. See {@link matchPattern}.
 */
function createPatternRouter<T>(entries: Record<string, T>) {
  const router = createRouter<{ route: string; data: T }>();
  for (const [route, data] of Object.entries(entries)) {
    addRoute(router, "", route, { route, data });
  }
  return router;
}

/**
 * Data of each registered pattern that matches every path `pattern` matches,
 * from the least to the most specific.
 */
function matchPattern<T>(router: RouterContext<{ route: string; data: T }>, pattern: string) {
  return findOverlappingRoutes(router, "", pattern)
    .filter(({ data }) => {
      const comparison = compareRoutes(data.route, pattern);
      return comparison === "equal" || comparison === "superset";
    })
    .map(({ data }) => data.data);
}

/**
 * Paths of the `redirect: false` rules that keep a CDN redirect from matching,
 * or `undefined` when one opts out only some of the methods of the redirect,
 * which a route cannot express, so the redirect is left to the server function.
 */
function getOptOutPaths(
  redirect: ReturnType<typeof parseRouteKey>,
  optOuts: ReturnType<typeof parseRouteKey>[]
): string[] | undefined {
  const paths: string[] = [];
  for (const optOut of optOuts) {
    const comparison = compareRoutes(redirect.path, optOut.path);
    if (comparison !== "superset" && comparison !== "equal") {
      continue;
    }
    if (!optOut.methods) {
      if (comparison === "superset") {
        paths.push(optOut.path);
      }
      continue;
    }
    if (redirect.methods?.every((method) => !optOut.methods!.includes(method))) {
      continue;
    }
    if (
      comparison === "superset" &&
      redirect.methods?.every((method) => optOut.methods!.includes(method))
    ) {
      paths.push(optOut.path);
      continue;
    }
    return undefined;
  }
  return paths;
}

/**
 * Keep the more specific `paths` out of a route regex with a negative lookahead,
 * instead of a route that stops routing before the asset and skew protection routes.
 * Their named groups are made non-capturing, so the `$n` references stay valid.
 */
function excludePaths(src: RegExp, paths: RegExp[]): string {
  const excluded = paths.map((path) =>
    path.source.slice(1, -1).replace(/\(\?<(?![=!])[^>]*>/g, "(?:")
  );
  return excluded.length > 0 ? `^(?!(?:${excluded.join("|")})$)${src.source.slice(1)}` : src.source;
}

/**
 * Whether `**` is interpolated into the query or fragment of a `redirect` or
 * `proxy` target. Vercel encodes such a capture unlike h3 (`+` becomes a space
 * and `&` starts a new param), so these rules are left to the server function.
 */
function hasQueryWildcard(to: string): boolean {
  const index = to.search(/[?#]/);
  return index !== -1 && to.includes("**", index);
}

async function getEnginesNodeVersion(range: string) {
  const { default: validRange } = await import("semver/ranges/valid.js");
  if (!validRange(range)) {
    return;
  }
  const { default: intersects } = await import("semver/ranges/intersects.js");
  return SUPPORTED_NODE_VERSIONS.filter((version) => intersects(`${version}.x`, range)).at(-1);
}

async function getEnginesBunRuntime(range: string, opts: { source: string }) {
  const { default: validRange } = await import("semver/ranges/valid.js");
  const { default: intersects } = await import("semver/ranges/intersects.js");
  if (validRange(range)) {
    // Vercel requires an explicit opt-in to Bun minor versions.
    if (intersects("1.4.x", range) && !intersects("<1.4.0", range)) {
      return "bun1.4.x";
    }
    if (intersects("1.x", range)) {
      return "bun1.x";
    }
  }
  throw new Error(
    `Invalid Vercel Bun version \`${range}\` in ${opts.source}. Use a range that matches \`1.x\` or \`1.4.x\`.`
  );
}
