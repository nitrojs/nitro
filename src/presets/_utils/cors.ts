import type { Nitro, NormalizedRouteRules } from "nitro/types";
import { compareRoutes } from "rou3";
import { joinURL } from "ufo";
import { parseRouteKey, sortRoutes } from "./routes.ts";

type CorsRule = NormalizedRouteRules["cors"];

const HEADER_LINE_RE = /^\s+(?:!\s*)?([\w-]+)/;
const PATH_LINE_RE = /^[^\s#]/;

/**
 * Static CORS headers for the public asset dirs that the platform serves on
 * its own (not `fallthrough`, with a base other than `/`), where the `cors`
 * rule, applied by the server at runtime, never runs.
 *
 * Only the headers that h3 sends to every simple (non preflight) request are
 * static: `access-control-allow-origin: *` and `access-control-expose-headers`.
 * A dir is left out with a warning when its `cors` rule depends on the
 * request (an origin allowlist), or when a rule for some of its files only
 * (more specific or method-scoped) sets another `cors` or one of these
 * headers. Headers that a rule for the whole dir already sets with `headers`,
 * or that the user's own `headersFile` (the contents of a `_headers` file)
 * sets for a path that may match the dir, are left to them, as platforms
 * join or override repeated headers.
 */
export function getPublicAssetCorsHeaders(
  nitro: Nitro,
  opts: { headersFile?: string } = {}
): { base: string; headers: Record<string, string> }[] {
  const routeRules = nitro.options.routeRules;
  const keys = sortRoutes(Object.keys(routeRules)).reverse();
  const entries: { base: string; files: string; headers: Record<string, string> }[] = [];

  for (const asset of nitro.options.publicAssets) {
    const base = asset.baseURL || "/";
    if (asset.fallthrough || base === "/") {
      continue;
    }
    // Every file of the dir, but not the path of the dir itself
    const files = joinURL(base, "**:file");
    const dirKeys = keys.filter((key) => covers(key, files));
    const cors = mergeCors(nitro, dirKeys);
    if (!cors) {
      continue;
    }
    const corsHeaders = getStaticCorsHeaders(cors);
    if (!corsHeaders) {
      nitro.logger.warn(
        `Not adding CORS headers to the public assets of \`${base}\`, as their \`cors\` rule allows only some origins. Set them with \`headers\` on \`${joinURL(base, "**")}\` instead.`
      );
      continue;
    }
    const conflict = keys.find((key) => {
      const { path, methods } = parseRouteKey(key);
      if (dirKeys.includes(key) || compareRoutes(path, files) === "disjoint") {
        return false;
      }
      const rule = routeRules[key]!;
      if (Object.keys(rule.headers || {}).some((header) => header.toLowerCase() in corsHeaders)) {
        return true;
      }
      if (rule.cors === undefined) {
        return false;
      }
      if (methods) {
        return true;
      }
      const inner = mergeCors(
        nitro,
        keys.filter((other) => dirKeys.includes(other) || covers(other, path))
      );
      return !isSameHeaders(inner ? getStaticCorsHeaders(inner) : undefined, corsHeaders);
    });
    if (conflict) {
      nitro.logger.warn(
        `Not adding CORS headers to the public assets of \`${base}\`, as the rule of \`${conflict}\` sets another CORS header for some of them only. Set them with \`headers\` instead.`
      );
      continue;
    }
    const userHeaders = new Set([
      ...dirKeys
        .flatMap((key) => Object.keys(routeRules[key]!.headers || {}))
        .map((header) => header.toLowerCase()),
      ...getFileHeaders(opts.headersFile || "", joinURL(nitro.options.baseURL, files)),
    ]);
    const headers = Object.fromEntries(
      Object.entries(corsHeaders).filter(([header]) => !userHeaders.has(header))
    );
    if (Object.keys(headers).length > 0) {
      entries.push({ base, files, headers });
    }
  }

  // A dir with the same base as an earlier one, or nested in another one, is
  // already covered by its headers
  return entries
    .filter(
      (entry, index) =>
        !entries.some((other, otherIndex) => {
          const comparison = compareRoutes(other.files, entry.files);
          return comparison === "superset" || (comparison === "equal" && otherIndex < index);
        })
    )
    .map(({ base, headers }) => ({ base, headers }));
}

/** Whether the method-agnostic rule `key` applies to every path of `pattern`. */
function covers(key: string, pattern: string): boolean {
  const { path, methods } = parseRouteKey(key);
  const comparison = compareRoutes(path, pattern);
  return !methods && (comparison === "equal" || comparison === "superset");
}

/** The `cors` rules of `keys` (least specific first) merged as h3 merges them. */
function mergeCors(nitro: Nitro, keys: string[]): CorsRule {
  let cors: CorsRule;
  for (const key of keys) {
    const rule = nitro.options.routeRules[key]!.cors;
    if (rule !== undefined) {
      cors = rule && cors ? { ...cors, ...rule } : rule;
    }
  }
  return cors;
}

/**
 * The headers h3 sends to every simple request for `cors`, or `undefined`
 * when they depend on the request origin.
 */
function getStaticCorsHeaders(
  cors: Exclude<CorsRule, false | undefined>
): Record<string, string> | undefined {
  if (cors.origin && cors.origin !== "*") {
    return undefined;
  }
  const headers: Record<string, string> = { "access-control-allow-origin": "*" };
  const exposeHeaders = cors.exposeHeaders ?? "*";
  if (exposeHeaders.length > 0) {
    headers["access-control-expose-headers"] =
      exposeHeaders === "*" ? "*" : exposeHeaders.join(",");
  }
  return headers;
}

/**
 * Header names (lower case) that a `_headers` file sets or detaches (`! name`)
 * for paths that may match `pattern`. A path that cannot be compared is
 * assumed to match.
 */
function getFileHeaders(contents: string, pattern: string): string[] {
  const headers: string[] = [];
  let matches = false;
  for (const line of contents.split("\n")) {
    const header = HEADER_LINE_RE.exec(line);
    if (header) {
      if (matches) {
        headers.push(header[1]!.toLowerCase());
      }
    } else if (PATH_LINE_RE.test(line)) {
      matches = mayMatch(line.trim(), pattern);
    }
  }
  return headers;
}

function mayMatch(splatPath: string, pattern: string): boolean {
  try {
    return compareRoutes(splatPath.replaceAll("*", "**"), pattern) !== "disjoint";
  } catch {
    return true;
  }
}

function isSameHeaders(a: Record<string, string> | undefined, b: Record<string, string>) {
  return JSON.stringify(a) === JSON.stringify(b);
}
