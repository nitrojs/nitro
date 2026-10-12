import type { HTTPEvent } from "h3";
import type {
  CacheOptions,
  CachedEventHandlerOptions as OCacheEventHandlerOptions,
  HTTPEvent as OCacheHTTPEvent,
} from "ocache";

export type { CacheEntry, CacheOptions, CachedFunction, ResponseCacheEntry } from "ocache";

/**
 * Options for `defineCachedFunction`.
 *
 * @see https://nitro.build/docs/cache
 */
export type CachedFunctionOptions<T = any, ArgsT extends unknown[] = any[]> = CacheOptions<
  T,
  ArgsT
>;

/**
 * Options for `defineCachedHandler`.
 *
 * @see https://nitro.build/docs/cache
 */
export interface CachedHandlerOptions extends Omit<
  OCacheEventHandlerOptions<HTTPEvent & OCacheHTTPEvent>,
  "toResponse" | "createResponse" | "handleCacheHeaders"
> {}

/** @deprecated Use {@link CachedHandlerOptions}. */
export type CachedEventHandlerOptions = CachedHandlerOptions;
