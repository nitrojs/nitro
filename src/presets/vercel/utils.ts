import fsp from "node:fs/promises";
import { defu } from "defu";
import mime from "mime";
import { writeFile } from "nitropack/kit";
import type { Nitro, NitroRouteRules, PrerenderRoute } from "nitropack/types";
import { dirname, relative, resolve } from "pathe";
import { joinURL, withLeadingSlash, withoutLeadingSlash } from "ufo";
import type {
  PrerenderFunctionConfig,
  VercelBuildConfigV3,
  VercelServerlessFunctionConfig,
} from "./types";
import { isTest } from "std-env";
import { createRouter as createRadixRouter, toRouteMatcher } from "radix3";
import { ISR_URL_PARAM } from "./runtime/consts";

// https://vercel.com/docs/build-output-api/configuration

// https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
// https://github.com/vercel/vercel/blob/main/packages/build-utils/src/fs/node-version.ts
const SUPPORTED_NODE_VERSIONS = [22, 24, 26];

const FALLBACK_ROUTE = "/__fallback";

const ISR_SUFFIX = "-isr"; // Avoid using . as it can conflict with routing

const SAFE_FS_CHAR_RE = /[^a-zA-Z0-9_.[\]/]/g;

// Vercel serves `<dir>/index.html` (and extensionless `<dir>/index`) at `<dir>`
// using built-in directory indexes.
const INDEX_FILE_RE = /(^|\/)index(\.html)?$/;

const SURROUNDING_SLASH_RE = /^\/+|\/+$/g;

function getSystemNodeVersion() {
  const systemNodeVersion = Number.parseInt(
    process.versions.node.split(".")[0]
  );

  return Number.isNaN(systemNodeVersion) ? 22 : systemNodeVersion;
}

export function resolveNodeRuntime(
  systemNodeVersion = getSystemNodeVersion()
): `nodejs${number}.x` {
  const usedNodeVersion =
    SUPPORTED_NODE_VERSIONS.find((version) => version >= systemNodeVersion) ??
    SUPPORTED_NODE_VERSIONS.at(-1)!;
  return `nodejs${usedNodeVersion}.x`;
}

export async function generateFunctionFiles(nitro: Nitro) {
  const o11Routes = getObservabilityRoutes(nitro);

  const buildConfigPath = resolve(nitro.options.output.dir, "config.json");
  const buildConfig = generateBuildConfig(nitro, o11Routes);
  await writeFile(buildConfigPath, JSON.stringify(buildConfig, null, 2));

  // Runtime
  // 1. Respect explicit runtime from nitro config
  let runtime: VercelServerlessFunctionConfig["runtime"] =
    nitro.options.vercel?.functions?.runtime;
  // 2. Read runtime from vercel.json if specified
  if (!runtime) {
    const vercelConfig = await readVercelConfig(nitro.options.rootDir);
    // Use bun runtime if bunVersion is specified or bun used to build
    if (vercelConfig.bunVersion || "Bun" in globalThis) {
      runtime = `bun${vercelConfig.bunVersion || "1.x"}`;
    } else {
      // 3. Auto-detect runtime based on system Node.js version
      runtime = resolveNodeRuntime();
    }
  }

  const functionConfigPath = resolve(
    nitro.options.output.serverDir,
    ".vc-config.json"
  );
  const functionConfig: VercelServerlessFunctionConfig = {
    runtime,
    ...nitro.options.vercel?.functions,
    handler: "index.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    supportsResponseStreaming: true,
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
  const _routeRulesMatcher = toRouteMatcher(
    createRadixRouter({ routes: nitro.options.routeRules })
  );
  const _getRouteRules = (path: string) =>
    defu({}, ..._routeRulesMatcher.matchAll(path).reverse()) as NitroRouteRules;
  for (const route of o11Routes) {
    const routeRules = _getRouteRules(route.src);
    if (routeRules.isr) {
      continue; // #3563
    }
    const funcPrefix = resolve(
      nitro.options.output.serverDir,
      "..",
      route.dest
    );
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

  const functionConfigPath = resolve(
    nitro.options.output.serverDir,
    ".vc-config.json"
  );
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

  const config = defu(nitro.options.vercel?.config, <VercelBuildConfigV3>{
    version: 3,
    framework: {
      name: nitro.options.framework.name,
      version: nitro.options.framework.version,
    },
    overrides: getPrerenderOverrides(nitro._prerenderedRoutes),
    routes: [
      // Header-only rules (least specific first, so more specific headers override on `continue`)
      ...rules
        .filter(([_, routeRules]) => routeRules.headers && !routeRules.redirect)
        .reverse()
        .map(([path, routeRules]) => ({
          src: path.replace("/**", "/(.*)"),
          headers: routeRules.headers,
          continue: true,
        })),
      // Redirect rules
      ...rules
        .filter(
          (
            entry
          ): entry is [
            string,
            NitroRouteRules & {
              redirect: NonNullable<NitroRouteRules["redirect"]>;
            },
          ] => !!entry[1].redirect
        )
        .map(([path, routeRules]) => {
          let route = {
            src: path.replace("/**", "/(.*)"),
            status: routeRules.redirect.statusCode,
            headers: {
              Location: routeRules.redirect.to.replace("/**", "/$1"),
            },
          };
          if (routeRules.headers) {
            route = defu(route, { headers: routeRules.headers });
          }
          return route;
        }),
      // Skew protection
      ...(nitro.options.vercel?.skewProtection &&
      process.env.VERCEL_DEPLOYMENT_ID
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
                "Set-Cookie": `__vdpl=${process.env.VERCEL_DEPLOYMENT_ID}; Path=${nitro.options.baseURL}; SameSite=Lax; Secure; HttpOnly`,
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
  });

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
          dest:
            nitro.options.preset === "vercel-edge"
              ? FALLBACK_ROUTE + `?${ISR_URL_PARAM}=$${ISR_URL_PARAM}`
              : withLeadingSlash(
                  normalizeRouteDest(key) +
                    ISR_SUFFIX +
                    `?${ISR_URL_PARAM}=$${ISR_URL_PARAM}`
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
export function getPrerenderOverrides(
  prerenderedRoutes: PrerenderRoute[] = []
) {
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

export function deprecateSWR(nitro: Nitro) {
  if (nitro.options.future.nativeSWR) {
    return;
  }
  let hasLegacyOptions = false;
  for (const [key, value] of Object.entries(nitro.options.routeRules)) {
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

// --- utils for observability ---

type ObservabilityRoute = {
  src: string; // route pattern
  dest: string; // function name
};

function getObservabilityRoutes(nitro: Nitro): ObservabilityRoute[] {
  const compatDate =
    nitro.options.compatibilityDate.vercel ||
    nitro.options.compatibilityDate.default;
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

  const prerendered = nitro._prerenderedRoutes || [];
  return [
    ...normalizeRoutes(staticRoutes),
    ...normalizeRoutes(dynamicRoutes),
    ...normalizeRoutes(catchAllRoutes),
  ].filter((route) => {
    return !prerendered.some((r) => route.src === r.route);
  });
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
        return segment === "**"
          ? "(?:.*)"
          : `?(?<${namedGroup(segment.slice(3))}>.+)`;
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

  if (prerenderConfig.allowQuery) {
    // Vercel only forwards the query to the function with `passQuery`. Without
    // it, `allowQuery` params split the cache but never reach the render.
    if (
      prerenderConfig.passQuery === undefined &&
      prerenderConfig.allowQuery.some((key) => key !== ISR_URL_PARAM)
    ) {
      prerenderConfig.passQuery = true;
    }
    if (!prerenderConfig.allowQuery.includes(ISR_URL_PARAM)) {
      prerenderConfig.allowQuery = [
        ...prerenderConfig.allowQuery,
        ISR_URL_PARAM,
      ];
    }
  }

  await writeFile(filename, JSON.stringify(prerenderConfig, null, 2));
}
