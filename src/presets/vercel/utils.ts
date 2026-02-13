import fsp from "node:fs/promises";
import { defu } from "defu";
import { writeFile } from "../_utils/fs.ts";
import type { Nitro, NitroRouteRules } from "nitro/types";
import { dirname, relative, resolve } from "pathe";
import { joinURL, withLeadingSlash, withoutLeadingSlash } from "ufo";
import type {
  PrerenderFunctionConfig,
  VercelBuildConfigV3,
  VercelServerlessFunctionConfig,
} from "./types.ts";
import { isTest } from "std-env";
import { ISR_URL_PARAM } from "./runtime/isr.ts";

// https://vercel.com/docs/build-output-api/configuration

// https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
const SUPPORTED_NODE_VERSIONS = [20, 22, 24];

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

function getSystemNodeVersion() {
  const systemNodeVersion = Number.parseInt(process.versions.node.split(".")[0]);

  return Number.isNaN(systemNodeVersion) ? 22 : systemNodeVersion;
}

export async function generateFunctionFiles(nitro: Nitro) {
  const o11Routes = getObservabilityRoutes(nitro);

  const buildConfigPath = resolve(nitro.options.output.dir, "config.json");
  const buildConfig = generateBuildConfig(nitro, o11Routes);
  await writeFile(buildConfigPath, JSON.stringify(buildConfig, null, 2));

  const functionConfigPath = resolve(nitro.options.output.serverDir, ".vc-config.json");
  const functionConfig: VercelServerlessFunctionConfig = {
    handler: "index.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    supportsResponseStreaming: true,
    ...nitro.options.vercel?.functions,
  };
  await writeFile(functionConfigPath, JSON.stringify(functionConfig, null, 2));

  // Write ISR functions
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
    await fsp.symlink(
      "./" + relative(dirname(funcPrefix), nitro.options.output.serverDir),
      funcPrefix + ".func",
      "junction"
    );
    await writePrerenderConfig(
      funcPrefix + ".prerender-config.json",
      value.isr,
      nitro.options.vercel?.config?.bypassToken
    );
  }

  // Write observability routes
  if (o11Routes.length === 0) {
    return;
  }
  const _getRouteRules = (path: string) =>
    defu({}, ...nitro.routing.routeRules.matchAll("", path).reverse()) as NitroRouteRules;
  for (const route of o11Routes) {
    const routeRules = _getRouteRules(route.src);
    if (routeRules.isr) {
      continue; // #3563
    }
    const funcPrefix = resolve(nitro.options.output.serverDir, "..", route.dest);
    await fsp.mkdir(dirname(funcPrefix), { recursive: true });
    await fsp.symlink(
      "./" + relative(dirname(funcPrefix), nitro.options.output.serverDir),
      funcPrefix + ".func",
      "junction"
    );
  }
}

export async function generateEdgeFunctionFiles(nitro: Nitro) {
  const buildConfigPath = resolve(nitro.options.output.dir, "config.json");
  const buildConfig = generateBuildConfig(nitro);
  await writeFile(buildConfigPath, JSON.stringify(buildConfig, null, 2));

  const functionConfigPath = resolve(nitro.options.output.serverDir, ".vc-config.json");
  const functionConfig = {
    runtime: "edge",
    entrypoint: "index.mjs",
    regions: nitro.options.vercel?.regions,
  };
  await writeFile(functionConfigPath, JSON.stringify(functionConfig, null, 2));
}

export async function generateStaticFiles(nitro: Nitro) {
  const buildConfigPath = resolve(nitro.options.output.dir, "config.json");
  const buildConfig = generateBuildConfig(nitro);
  await writeFile(buildConfigPath, JSON.stringify(buildConfig, null, 2));
}

function generateBuildConfig(nitro: Nitro, o11Routes?: ObservabilityRoute[]) {
  const rules = Object.entries(nitro.options.routeRules).sort(
    (a, b) => b[0].split(/\/(?!\*)/).length - a[0].split(/\/(?!\*)/).length
  );

  // Determine which proxy rules can be offloaded to Vercel CDN rewrites
  const cdnProxyPaths = new Set(
    rules
      .filter(([_, routeRules]) => routeRules.proxy && canUseVercelRewrite(routeRules.proxy))
      .map(([path]) => path)
  );

  const config = defu(nitro.options.vercel?.config, {
    version: 3,
    overrides: {
      // Nitro static prerendered route overrides
      ...Object.fromEntries(
        (nitro._prerenderedRoutes?.filter((r) => r.fileName !== r.route) || []).map(
          ({ route, fileName }) => [
            withoutLeadingSlash(fileName),
            { path: route.replace(/^\//, "") },
          ]
        )
      ),
    },
    routes: [
      // Redirect and header rules (excluding paths handled as CDN proxy rewrites)
      ...rules
        .filter(
          ([path, routeRules]) =>
            (routeRules.redirect || routeRules.headers) && !cdnProxyPaths.has(path)
        )
        .map(([path, routeRules]) => {
          let route = {
            src: path.replace("/**", "/(.*)"),
          };
          if (routeRules.redirect) {
            route = defu(route, {
              status: routeRules.redirect.status,
              headers: {
                Location: routeRules.redirect.to.replace("/**", "/$1"),
              },
            });
          }
          if (routeRules.headers) {
            route = defu(route, { headers: routeRules.headers });
          }
          return route;
        }),
      // Proxy rewrite rules (CDN-level reverse proxy)
      // https://vercel.com/docs/rewrites
      ...rules
        .filter(([path]) => cdnProxyPaths.has(path))
        .map(([path, routeRules]) => {
          const proxy = routeRules.proxy!;
          const route: Record<string, any> = {
            src: path.replace("/**", "/(.*)"),
            dest: proxy.to.replace("/**", "/$1"),
          };
          if (routeRules.headers) {
            route.headers = routeRules.headers;
          }
          return route;
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
                "Set-Cookie": `__vdpl=${nitro.options.manifest.deploymentId}; Path=${nitro.options.baseURL}; SameSite=Strict; Secure; HttpOnly`,
              },
              continue: true,
            },
          ]
        : []),
      // Public asset rules
      ...nitro.options.publicAssets
        .filter((asset) => !asset.fallthrough)
        .map((asset) => joinURL(nitro.options.baseURL, asset.baseURL || "/"))
        .map((baseURL) => ({
          src: baseURL + "(.*)",
          headers: {
            "cache-control": "public,max-age=31536000,immutable",
          },
          continue: true,
        })),
      { handle: "filesystem" },
    ],
  } as VercelBuildConfigV3);

  // Cron jobs from scheduledTasks
  if (
    nitro.options.experimental.tasks &&
    Object.keys(nitro.options.scheduledTasks || {}).length > 0
  ) {
    const cronPath = nitro.options.vercel!.cronHandlerPath!;
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
    // ...If we are using an ISR function for /, then we need to write this explicitly
    ...(nitro.options.routeRules["/"]?.isr
      ? [
          {
            src: `(?<${ISR_URL_PARAM}>/)`,
            dest: `/index${ISR_SUFFIX}?${ISR_URL_PARAM}=$${ISR_URL_PARAM}`,
          },
        ]
      : []),
    // ...Add rest of the ISR routes
    ...rules
      .filter(([key, value]) => value.isr !== undefined && key !== "/")
      .map(([key, value]) => {
        const src = `(?<${ISR_URL_PARAM}>${normalizeRouteSrc(key)})`;
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
    // Observability routes
    ...(o11Routes || []).map((route) => ({
      src: joinURL(nitro.options.baseURL, route.src),
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

export function deprecateSWR(nitro: Nitro) {
  if (nitro.options.future.nativeSWR) {
    return;
  }
  let hasLegacyOptions = false;
  for (const [_key, value] of Object.entries(nitro.options.routeRules)) {
    if (_hasProp(value, "isr")) {
      continue;
    }
    if (value.cache === false) {
      value.isr = false;
    }
    if (_hasProp(value, "static")) {
      value.isr = !(value as { static: boolean }).static;
      hasLegacyOptions = true;
    }
    if (value.cache && _hasProp(value.cache, "swr")) {
      value.isr = value.cache.swr;
      hasLegacyOptions = true;
    }
  }
  if (hasLegacyOptions && !isTest) {
    nitro.logger.warn(
      "Nitro now uses `isr` option to configure ISR behavior on Vercel. Backwards-compatible support for `static` and `swr` options within the Vercel Build Options API will be removed in the future versions. Set `future.nativeSWR: true` nitro config disable this warning."
    );
  }
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

  // 2. Read runtime from vercel.json if specified
  const vercelConfig = await readVercelConfig(nitro.options.rootDir);

  // 3. Use bun runtime if bunVersion is specified or bun used to build
  if (vercelConfig.bunVersion || "Bun" in globalThis) {
    runtime = "bun1.x";
  } else {
    // 3. Auto-detect runtime based on system Node.js version
    const systemNodeVersion = getSystemNodeVersion();
    const usedNodeVersion =
      SUPPORTED_NODE_VERSIONS.find((version) => version >= systemNodeVersion) ??
      SUPPORTED_NODE_VERSIONS.at(-1);
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

function _hasProp(obj: any, prop: string) {
  return obj && typeof obj === "object" && prop in obj;
}

/**
 * Check if a proxy rule can be offloaded to a Vercel CDN rewrite.
 * A proxy is eligible when it targets an external URL and uses no
 * ProxyOptions that Vercel's routing layer cannot handle at the edge.
 */
function canUseVercelRewrite(proxy: NitroRouteRules["proxy"]): proxy is { to: string } {
  if (!proxy?.to) {
    return false;
  }
  // Must be an external URL
  if (!/^https?:\/\//.test(proxy.to.replace(/\/\*\*$/, ""))) {
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
  src: string; // route pattern
  dest: string; // function name
};

function getObservabilityRoutes(nitro: Nitro): ObservabilityRoute[] {
  const compatDate =
    nitro.options.compatibilityDate.vercel || nitro.options.compatibilityDate.default;
  if (compatDate < "2025-07-15") {
    return [];
  }

  // Sort routes by how much specific they are
  const routePatterns = [
    ...new Set([
      ...(nitro.options.ssrRoutes || []),
      ...[...nitro.scannedHandlers, ...nitro.options.handlers]
        .filter((h) => !h.middleware && h.route)
        .map((h) => h.route!),
    ]),
  ];

  const staticRoutes: string[] = [];
  const dynamicRoutes: string[] = [];
  const catchAllRoutes: string[] = [];

  for (const route of routePatterns) {
    if (route.includes("**")) {
      catchAllRoutes.push(route);
    } else if (route.includes(":") || route.includes("*")) {
      dynamicRoutes.push(route);
    } else {
      staticRoutes.push(route);
    }
  }

  return [
    ...normalizeRoutes(staticRoutes),
    ...normalizeRoutes(dynamicRoutes),
    ...normalizeRoutes(catchAllRoutes),
  ];
}

function normalizeRoutes(routes: string[]) {
  return routes
    .sort((a, b) =>
      // a.split("/").length - b.split("/").length ||
      b.localeCompare(a)
    )
    .map((route) => ({
      src: normalizeRouteSrc(route),
      dest: normalizeRouteDest(route),
    }));
}

// Input is a rou3/radix3 compatible route pattern
// Output is a PCRE-compatible regular expression that matches each incoming pathname
// Reference: https://github.com/h3js/rou3/blob/main/src/regexp.ts
function normalizeRouteSrc(route: string): string {
  let idCtr = 0;
  return route
    .split("/")
    .map((segment) => {
      if (segment.startsWith("**")) {
        return segment === "**" ? "(?:.*)" : `?(?<${namedGroup(segment.slice(3))}>.+)`;
      }
      if (segment === "*") {
        return `(?<_${idCtr++}>[^/]*)`;
      }
      if (segment.includes(":")) {
        return segment
          .replace(/:(\w+)/g, (_, id) => `(?<${namedGroup(id)}>[^/]+)`)
          .replace(/\./g, String.raw`\.`);
      }
      return segment;
    })
    .join("/");
}

// Valid PCRE capture group name
function namedGroup(input = "") {
  if (/\d/.test(input[0])) {
    input = `_${input}`;
  }
  return input.replace(/[^a-zA-Z0-9_]/g, "") || "_";
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
        if (segment === "*") {
          return "[-]";
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

async function writePrerenderConfig(
  filename: string,
  isrConfig: NitroRouteRules["isr"],
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

  if (prerenderConfig.allowQuery && !prerenderConfig.allowQuery.includes(ISR_URL_PARAM)) {
    prerenderConfig.allowQuery.push(ISR_URL_PARAM);
  }

  await writeFile(filename, JSON.stringify(prerenderConfig, null, 2));
}
