import fsp from "node:fs/promises";
import { defu } from "defu";
import { writeFile } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { dirname, relative, resolve } from "pathe";
import { joinURL, withoutLeadingSlash } from "ufo";
import type {
  PrerenderFunctionConfig,
  VercelBuildConfigV3,
  VercelServerlessFunctionConfig,
} from "./types";
import { isTest } from "std-env";

// https://vercel.com/docs/build-output-api/configuration

// https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
const SUPPORTED_NODE_VERSIONS = [18, 20, 22];

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

  const systemNodeVersion = getSystemNodeVersion();
  const usedNodeVersion =
    SUPPORTED_NODE_VERSIONS.find((version) => version >= systemNodeVersion) ??
    SUPPORTED_NODE_VERSIONS.at(-1);

  const runtimeVersion = `nodejs${usedNodeVersion}.x`;
  const functionConfigPath = resolve(
    nitro.options.output.serverDir,
    ".vc-config.json"
  );
  const functionConfig: VercelServerlessFunctionConfig = {
    runtime: runtimeVersion,
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

    // Normalize route rule
    let isrConfig = value.isr;
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
      bypassToken: nitro.options.vercel?.config?.bypassToken,
      ...isrConfig,
    };

    // Allow query parameter for wildcard routes
    if (key.includes("/**") /* wildcard */) {
      isrConfig.allowQuery = isrConfig.allowQuery || [];
      if (!isrConfig.allowQuery.includes("url")) {
        isrConfig.allowQuery.push("url");
      }
    }

    const funcPrefix = resolve(
      nitro.options.output.serverDir,
      ".." + generateEndpoint(key)
    );
    await fsp.mkdir(dirname(funcPrefix), { recursive: true });
    await fsp.symlink(
      "./" + relative(dirname(funcPrefix), nitro.options.output.serverDir),
      funcPrefix + ".func",
      "junction"
    );
    await writeFile(
      funcPrefix + ".prerender-config.json",
      JSON.stringify(prerenderConfig, null, 2)
    );
  }

  // Write observability routes
  for (const route of o11Routes) {
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
    ...rules
      .filter(
        ([key, value]) =>
          // value.isr === false || (value.isr && key.includes("/**"))
          value.isr !== undefined && key !== "/"
      )
      .map(([key, value]) => {
        const src = key.replace(/^(.*)\/\*\*/, "(?<url>$1/.*)");
        if (value.isr === false) {
          // we need to write a rule to avoid route being shadowed by another cache rule elsewhere
          return {
            src,
            dest: "/__fallback",
          };
        }
        return {
          src,
          dest:
            nitro.options.preset === "vercel-edge"
              ? "/__fallback?url=$url"
              : generateEndpoint(key) + "?url=$url",
        };
      }),
    // If we are using an ISR function for /, then we need to write this explicitly
    ...(nitro.options.routeRules["/"]?.isr
      ? [
          {
            src: "(?<url>/)",
            dest: "/__fallback-index?url=$url",
          },
        ]
      : []),
    // Observability routes
    ...(o11Routes || []).map((route) => ({
      src: joinURL(nitro.options.baseURL, route.src),
      dest: "/" + route.dest,
    })),
    // If we are using an ISR function as a fallback
    // then we do not need to output the below fallback route as well
    ...(nitro.options.routeRules["/**"]?.isr
      ? []
      : [
          {
            src: "/(.*)",
            dest: "/__fallback",
          },
        ])
  );

  return config;
}

function generateEndpoint(url: string) {
  if (url === "/") {
    return "/__fallback-index";
  }
  return url.includes("/**")
    ? "/__fallback-" +
        withoutLeadingSlash(url.replace(/\/\*\*.*/, "").replace(/[^a-z]/g, "-"))
    : url;
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
      .map((segment) => segment.replace(/[^a-zA-Z0-9_.[\]]/g, "-"))
      .join("/") || "index"
  );
}
