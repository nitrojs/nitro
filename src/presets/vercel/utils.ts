import fsp from "node:fs/promises";
import { defu } from "defu";
import { writeFile } from "nitropack/kit";
import type { Nitro, NitroRouteRules } from "nitropack/types";
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
const SUPPORTED_NODE_VERSIONS = [18, 20, 22];

const FALLBACK_ROUTE = "/__fallback";

const ISR_SUFFIX = "-isr"; // Avoid using . as it can conflict with routing

const SAFE_FS_CHAR_RE = /[^a-zA-Z0-9_.[\]/]/g;

function getSystemNodeVersion() {
  const systemNodeVersion = Number.parseInt(
    process.versions.node.split(".")[0]
  );

  return Number.isNaN(systemNodeVersion) ? 22 : systemNodeVersion;
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
      const systemNodeVersion = getSystemNodeVersion();
      const usedNodeVersion =
        SUPPORTED_NODE_VERSIONS.find(
          (version) => version >= systemNodeVersion
        ) ?? SUPPORTED_NODE_VERSIONS.at(-1);
      runtime = `nodejs${usedNodeVersion}.x`;
    }
  }

  const baseFunctionConfig: VercelServerlessFunctionConfig = {
    runtime,
    ...nitro.options.vercel?.functions,
    handler: "index.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    supportsResponseStreaming: true,
  };

  if (
    Array.isArray(baseFunctionConfig.experimentalTriggers) &&
    (baseFunctionConfig.experimentalTriggers as unknown[]).length > 0
  ) {
    nitro.logger.warn(
      "`experimentalTriggers` on the base `vercel.functions` config applies to the catch-all function and is likely not what you want. " +
        "Routes with queue triggers are not accessible on the web. " +
        "Use `vercel.functionRules` to attach triggers to specific routes instead."
    );
  }

  const functionConfigPath = resolve(
    nitro.options.output.serverDir,
    ".vc-config.json"
  );
  await writeFile(
    functionConfigPath,
    JSON.stringify(baseFunctionConfig, null, 2)
  );

  const functionRules = nitro.options.vercel?.functionRules
    ? Object.fromEntries(
        Object.entries(nitro.options.vercel.functionRules).map(([k, v]) => [
          withLeadingSlash(k),
          v,
        ])
      )
    : undefined;
  const hasFunctionRules =
    functionRules && Object.keys(functionRules).length > 0;
  let routeFuncMatcher: ReturnType<typeof toRouteMatcher> | undefined;
  if (hasFunctionRules) {
    routeFuncMatcher = toRouteMatcher(
      createRadixRouter({ routes: functionRules })
    );
  }

  // Write ISR functions
  // Tracks base (non-ISR-suffixed) func paths for routes that have ISR,
  // so functionRules loop can skip patterns already handled here.
  const isrBasePaths = new Set<string>();
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

    const matchedRules = routeFuncMatcher
      ? (defu(
          {},
          ...routeFuncMatcher.matchAll(key).reverse()
        ) as VercelServerlessFunctionConfig)
      : undefined;
    if (matchedRules && Object.keys(matchedRules).length > 0) {
      isrBasePaths.add(
        resolve(
          nitro.options.output.serverDir,
          "..",
          normalizeRouteDest(key) + ".func"
        )
      );
      await createFunctionDirWithCustomConfig(
        funcPrefix + ".func",
        nitro.options.output.serverDir,
        baseFunctionConfig,
        matchedRules,
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
  if (hasFunctionRules) {
    for (const [pattern, overrides] of Object.entries(functionRules!)) {
      const funcDir = resolve(
        nitro.options.output.serverDir,
        "..",
        normalizeRouteDest(pattern) + ".func"
      );
      // Skip if ISR already created a custom config function for this route
      if (isrBasePaths.has(funcDir)) {
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
  const _routeRulesMatcher = toRouteMatcher(
    createRadixRouter({ routes: nitro.options.routeRules })
  );
  const _getRouteRules = (path: string) =>
    defu({}, ..._routeRulesMatcher.matchAll(path).reverse()) as NitroRouteRules;
  for (const route of o11Routes) {
    const routeRules = _getRouteRules(route.pattern);
    if (routeRules.isr) {
      continue; // #3563
    }
    const funcPrefix = resolve(
      nitro.options.output.serverDir,
      "..",
      route.dest
    );
    const funcDir = funcPrefix + ".func";

    // Skip if already created by functionRules
    if (createdFuncDirs.has(funcDir)) {
      continue;
    }

    const matchedRules = routeFuncMatcher
      ? (defu(
          {},
          ...routeFuncMatcher.matchAll(route.pattern).reverse()
        ) as VercelServerlessFunctionConfig)
      : undefined;
    if (matchedRules && Object.keys(matchedRules).length > 0) {
      await createFunctionDirWithCustomConfig(
        funcDir,
        nitro.options.output.serverDir,
        baseFunctionConfig,
        matchedRules,
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
    overrides: {
      // Nitro static prerendered route overrides
      ...Object.fromEntries(
        (
          nitro._prerenderedRoutes?.filter((r) => r.fileName !== r.route) || []
        ).map(({ route, fileName }) => [
          withoutLeadingSlash(fileName),
          { path: route.replace(/^\//, "") },
        ])
      ),
    },
    routes: [
      // Redirect and header rules
      ...rules
        .filter(([_, routeRules]) => routeRules.redirect || routeRules.headers)
        .map(([path, routeRules]) => {
          let route = {
            src: path.replace("/**", "/(.*)"),
          };
          if (routeRules.redirect) {
            route = defu(route, {
              status: routeRules.redirect.statusCode,
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
                "Set-Cookie": `__vdpl=${process.env.VERCEL_DEPLOYMENT_ID}; Path=${nitro.options.baseURL}; SameSite=Strict; Secure; HttpOnly`,
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
    // Route function config routes (skip patterns already handled by ISR or observability)
    ...(nitro.options.vercel?.functionRules
      ? Object.keys(nitro.options.vercel.functionRules)
          .map((p) => withLeadingSlash(p))
          .filter(
            (pattern) =>
              !rules.some(([key, value]) => value.isr && key === pattern) &&
              !(o11Routes || []).some(
                (r) => r.dest === normalizeRouteDest(pattern)
              )
          )
          .map((pattern) => ({
            src: joinURL(nitro.options.baseURL, normalizeRouteSrc(pattern)),
            dest: withLeadingSlash(normalizeRouteDest(pattern)),
          }))
      : []),
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
  src: string; // PCRE-compatible route pattern for config.json
  dest: string; // function name
  pattern: string; // original radix3-compatible route pattern
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
      pattern: route,
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

/**
 * Encodes a function path into a consumer name for queue/v2beta triggers.
 * Mirrors the encoding from @vercel/build-utils sanitizeConsumerName().
 * @see https://github.com/vercel/vercel/blob/main/packages/build-utils/src/lambda.ts
 */
function sanitizeConsumerName(functionPath: string): string {
  let result = "";
  for (const char of functionPath) {
    switch (char) {
      case "_": {
        result += "__";
        break;
      }
      case "/": {
        result += "_S";
        break;
      }
      case ".": {
        result += "_D";
        break;
      }
      default: {
        result += /[A-Za-z0-9-]/.test(char)
          ? char
          : "_" +
            char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
      }
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
  // Copy the entire server directory instead of symlinking individual
  // entries. Vercel's build container preserves symlinks in the Lambda
  // zip, but symlinks pointing outside the .func directory break at
  // runtime because the target path doesn't exist on Lambda.
  await fsp.cp(serverDir, funcDir, { recursive: true });
  // defu merges arrays, but for function config we want overrides to replace arrays entirely
  const mergedConfig = {
    ...defu(overrides, baseFunctionConfig),
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, v]) => Array.isArray(v))
    ),
  };

  // Auto-derive consumer for queue/v2beta triggers
  const triggers = mergedConfig.experimentalTriggers;
  if (Array.isArray(triggers)) {
    for (const trigger of triggers as Array<Record<string, unknown>>) {
      if (trigger.type === "queue/v2beta" && !trigger.consumer) {
        trigger.consumer = sanitizeConsumerName(functionPath);
      }
    }
  }

  await writeFile(
    resolve(funcDir, ".vc-config.json"),
    JSON.stringify(mergedConfig, null, 2)
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

  if (
    prerenderConfig.allowQuery &&
    !prerenderConfig.allowQuery.includes(ISR_URL_PARAM)
  ) {
    prerenderConfig.allowQuery.push(ISR_URL_PARAM);
  }

  await writeFile(filename, JSON.stringify(prerenderConfig, null, 2));
}
