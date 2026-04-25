import type { Middleware, ProxyOptions, BasicAuthOptions } from "h3";
import type { ExcludeFunctions, IntRange } from "./_utils.ts";
import type { CachedEventHandlerOptions } from "./runtime/index.ts";

/** Valid HTTP status code range (100–599). */
export type HTTPstatus = IntRange<100, 599>;

/**
 * Route rule options that can be applied to matching route patterns.
 *
 * Rules are matched against the request path (without query string or
 * `app.baseURL`) using rou3 pattern matching. When multiple patterns match,
 * their options are deep-merged with more-specific patterns taking precedence.
 *
 *
 * @see https://nitro.build/docs/routing#route-rules
 */
export interface NitroRouteConfig {
  /**
   * Enables runtime caching.
   *
   * When set to an options object, matching handlers are wrapped with
   * `defineCachedHandler`. Set to `false` to disable caching.
   *
   * @see https://nitro.build/docs/cache
   */
  cache?: ExcludeFunctions<CachedEventHandlerOptions> | false;

  /**
   * Response headers to set for matching routes.
   *
   * @example
   * ```ts
   * headers: { 'cache-control': 's-maxage=60' }
   * ```
   *
   * @see https://nitro.build/docs/routing#headers
   */
  headers?: Record<string, string>;

  /**
   * Server-side redirect for matching routes.
   *
   * A plain string defaults to status `307`. Use an object to specify a
   * custom status code. When the rule key ends with `/**` and `to` also
   * ends with `/**`, the matched path tail is appended to the destination.
   *
   * @example
   * ```ts
   * redirect: '/new-page'
   * redirect: { to: '/new-page', status: 301 }
   * ```
   *
   * @see https://nitro.build/docs/routing#redirect
   */
  redirect?: string | { to: string; status?: HTTPstatus };

  /**
   * Add this route to the prerender queue at build time.
   *
   * Only exact paths are collected; wildcard rules apply at runtime but are
   * not auto-added to the queue. Set to `false` to explicitly exclude a
   * route from prerendering.
   *
   * @see https://nitro.build/docs/routing#prerender
   */
  prerender?: boolean;

  /**
   * Proxy matching requests to another origin or internal path.
   *
   * A plain string specifies the destination. Use an object for additional
   * H3 {@link ProxyOptions}. Wildcard `/**` tail behavior works the same
   * as {@link NitroRouteConfig.redirect | redirect}.
   *
   * **IMPORTANT:** Proxy target should be a trusted and safe origin.
   *
   * @see https://nitro.build/docs/routing#proxy
   */
  proxy?: string | ({ to: string } & ProxyOptions);

  /**
   * Incremental Static Regeneration on supported platforms.
   *
   * - `number` — revalidation time in seconds.
   * - `true` — never expires until the next deployment.
   * - `false` — disable ISR for this route.
   *
   * Only handled by presets with native support (e.g. Vercel, Netlify).
   * Ignored on platforms without ISR support.
   *
   * @see https://nitro.build/docs/routing#isr-vercel
   */
  isr?: number /* expiration */ | boolean | VercelISRConfig;

  /**
   * Protect matching routes with HTTP Basic Authentication.
   *
   * **IMPORTANT:** Depending on the deployment platform, this might not apply to public assets.
   *
   * Set to `false` to disable auth inherited from a less-specific pattern.
   *
   * @see https://nitro.build/docs/routing#basic-auth
   */
  basicAuth?: Pick<BasicAuthOptions, "password" | "username" | "realm"> | false;

  // Shortcuts

  /**
   * Shortcut to add permissive CORS headers (`access-control-allow-origin: *`,
   * `access-control-allow-methods: *`, `access-control-allow-headers: *`,
   * `access-control-max-age: 0`). Override individual headers via
   * {@link NitroRouteConfig.headers | headers}.
   *
   * @see https://nitro.build/docs/routing#cors
   */
  cors?: boolean;

  /**
   * Shortcut for `cache: { swr: true, maxAge?: number }`.
   *
   * - `true` — enable SWR with no explicit `maxAge`.
   * - `number` — enable SWR with the given `maxAge` in seconds.
   *
   * @see https://nitro.build/docs/routing#caching-swr-static
   */
  swr?: boolean | number;

  static?: boolean | number;
}

/**
 * Normalized route rules used at runtime after shortcut resolution.
 */
export interface NitroRouteRules extends Omit<
  NitroRouteConfig,
  "redirect" | "cors" | "swr" | "static"
> {
  redirect?: { to: string; status: HTTPstatus };
  proxy?: { to: string } & ProxyOptions;
  [key: string]: any;
}

export type MatchedRouteRule<K extends keyof NitroRouteRules = "custom"> = {
  name: K;
  options: Exclude<NitroRouteRules[K], false>;
  route: string;
  params?: Record<string, string>;
  /**
   * Middleware constructor. May expose an `order` property — lower runs first
   * (default `0`).
   */
  handler?: ((opts: unknown) => Middleware) & { order?: number };
};

export type MatchedRouteRules = {
  [K in keyof NitroRouteRules]: MatchedRouteRule<K>;
};

// https://vercel.com/docs/build-output-api/primitives#prerender-configuration-file
export interface VercelISRConfig {
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

  /**
   * (vercel)
   *
   * When `true`, expose the response body regardless of status code including error status codes. (default `false`)
   */
  exposeErrBody?: boolean;
}
