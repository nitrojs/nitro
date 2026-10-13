import type { HTTPEvent } from "h3";

export type { CacheEntry, CacheOptions, CachedFunction, ResponseCacheEntry } from "ocache";

/**
 * Options for `defineCachedFunction`.
 *
 * @see https://nitro.build/docs/cache
 */
export type CachedFunctionOptions<
  T = any,
  ArgsT extends unknown[] = any[],
> = import("ocache").CacheOptions<T, ArgsT>;

/**
 * Options for `defineCachedHandler`.
 *
 * @see https://nitro.build/docs/cache
 */
export interface CachedHandlerOptions extends Omit<
  import("ocache").CachedEventHandlerOptions<HTTPEvent & import("ocache").HTTPEvent>,
  "toResponse" | "createResponse" | "handleCacheHeaders"
> {}

/** @deprecated Use {@link CachedHandlerOptions}. */
export type CachedEventHandlerOptions = CachedHandlerOptions;
