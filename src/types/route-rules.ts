import type { ProxyOptions } from "h3";
import type { ExcludeFunctions, IntRange } from "./_utils";
import type { CachedEventHandlerOptions } from "./runtime";

/**
 * Valid HTTP status code range.
 */
export type HTTPStatusCode = IntRange<100, 600>;

/**
 * Route rule options that can be applied to matching route patterns.
 *
 * These options are resolved and merged for every incoming request using radix3
 * pattern matching (against the path portion without the configured app.baseURL).
 * Some options are shortcuts and will be normalized into other properties
 * (see {@link NitroRouteRules}).
 *
 * @see https://nitro.build/guide/routing#route-rules
 */
export interface NitroRouteConfig {
  /**
   * Server-side response caching controls.
   *
   * - When set to an object, matching handlers are wrapped with
   *   `defineCachedEventHandler` using the provided options.
   * - When set to `false`, server-side caching is disabled for matching routes.
   *
   * @remarks
   * The {@link NitroRouteConfig.swr | swr} shortcut below is equivalent to
   * `cache: { swr: true, maxAge?: number }`.
   *
   * @see https://nitro.build/guide/cache
   */
  cache?: ExcludeFunctions<CachedEventHandlerOptions> | false;

  /**
   * Response headers to set for matching routes.
   *
   * @example
   * ```ts
   * headers: {
   *   'cache-control': 's-maxage=600, stale-while-revalidate=86400'
   * }
   * ```
   */
  headers?: Record<string, string>;

  /**
   * Server-side redirect for matching routes.
   *
   * You can specify:
   * - A string destination (defaults to status code 307), or
   * - An object with `to` and an optional `statusCode`.
   *
   * Wildcard behavior:
   * - When the rule key ends with `/**`, the matched path (minus the base) will be appended to the `to` if it also ends with `/**`.
   * - Query parameters from the incoming request are preserved when `to` is not a wildcard pattern.
   *
   * @example
   * ```ts
   * redirect: '/new-page' // 307 by default
   * // or
   * redirect: { to: '/new-page/**', statusCode: 301 }
   * ```
   */
  redirect?: string | { to: string; statusCode?: HTTPStatusCode };

  /**
   * Include this route in the prerendering queue at build time.
   *
   * @remarks
   * - Only exact paths (no wildcards) are collected automatically into the
   *   prerender list.
   * - Wildcard rules still apply at runtime but are not auto-added to the
   *   prerender queue.
   * - Set to `false` on a matching rule to explicitly disable prerendering for
   *   that route.
   *
   * @see https://nitro.build/config#prerender
   */
  prerender?: boolean;

  /**
   * Forward matching requests to another origin or internal endpoint.
   *
   * You can specify:
   * - A string destination, or
   * - An object with `to` and any additional `h3` ProxyOptions (e.g. headers, changeOrigin, etc.).
   *
   * Wildcard behavior:
   * - When the rule key ends with `/**`, the matched path (minus the base) will be appended to `to` if it also ends with `/**`.
   * - Query parameters from the incoming request are preserved when `to` is not a wildcard pattern.
   *
   * @see h3 ProxyOptions: https://github.com/h3js/h3/blob/ec77d6bc148e4ff7629ba56577697055cc0fcf2e/src/utils/proxy.ts#L11
   */
  proxy?: string | ({ to: string } & ProxyOptions);

  /**
   * Incremental Static Regeneration (ISR) / Stale-While-Revalidate semantics on supported platforms.
   *
   * - `number`: revalidation time in seconds.
   * - `true`: never expires until the next deployment.
   * - `false`: disable ISR for this route.
   *
   * Platform notes:
   * - Platform presets (e.g., Vercel/Netlify) map this option to native rules or headers as appropriate.
   * - On platforms without native support, behavior may fall back to HTTP cache headers.
   */
  isr?: number /* expiration */ | boolean | VercelISRConfig;

  //_________________________________Shortcuts_________________________________

  /**
   * Shortcut to add permissive CORS headers.
   *
   * Adds defaults:
   * - `access-control-allow-origin: "*"`
   * - `access-control-allow-methods: "*"`
   * - `access-control-allow-headers: "*"`
   * - `access-control-max-age: "0"`
   *
   * You can override or extend with an explicit {@link NitroRouteConfig.headers | headers} rule.
   */
  cors?: boolean;
  /**
   * Shortcut for server cache SWR behavior.
   *
   * - `true`: enable SWR with default TTL (no `maxAge` set).
   * - `number`: shorthand for `cache: { swr: true, maxAge: <number> }`.
   *
   * Legacy note:
   * - On platforms with native ISR (e.g., Vercel/Netlify), prefer `isr` for full platform integration.
   */
  swr?: boolean | number;
  /**
   * Legacy alias primarily used by platform presets (e.g., Vercel) historically.
   *
   * - In Vercel integration, `static: true` was treated similarly to `isr: false`.
   * - Prefer using `isr` directly for clarity and platform support.
   *
   * This field is kept for backwards compatibility and may be ignored in core normalization.
   */
  static?: boolean | number;
}

/**
 * Normalized route rules that Nitro uses at runtime after resolving shortcuts.
 *
 * Differences from NitroRouteConfig:
 * - `redirect` is always an object `{ to, statusCode }`.
 * - `proxy` is always an object `{ to, ...ProxyOptions }`.
 * - Shortcut fields (`cors`, `swr`, `static`) are omitted after normalization.
 */
export interface NitroRouteRules
  extends Omit<NitroRouteConfig, "redirect" | "cors" | "swr" | "static"> {
  redirect?: { to: string; statusCode: HTTPStatusCode };
  proxy?: { to: string } & ProxyOptions;
}

interface VercelISRConfig {
  /**
   * (vercel)
   * Expiration time (in seconds) before the cached asset will be re-generated by invoking the Serverless Function.
   * Setting the value to `false` (or `isr: true` route rule) means it will never expire.
   */
  expiration?: number | false;

  /**
   * (vercel)
   * Group number of the asset.
   * Prerender assets with the same group number will all be re-validated at the same time.
   */
  group?: number;

  /**
   * (vercel)
   * List of query string parameter names that will be cached independently.
   * - If an empty array, query values are not considered for caching.
   * - If undefined each unique query value is cached independently
   * - For wildcard `/**` route rules, `url` is always added.
   */
  allowQuery?: string[];

  /**
   * (vercel)
   * When `true`, the query string will be present on the `request` argument passed to the invoked function. The `allowQuery` filter still applies.
   */
  passQuery?: boolean;
}
