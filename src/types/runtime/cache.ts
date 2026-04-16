import type { HTTPEvent } from "h3";

export type { CacheEntry, CacheOptions, ResponseCacheEntry } from "ocache";

/**
 * Options for `defineCachedHandler`.
 *
 * @see https://nitro.build/docs/cache
 */
export interface CachedEventHandlerOptions extends Omit<
  import("ocache").CachedEventHandlerOptions<HTTPEvent & import("ocache").HTTPEvent>,
  "toResponse" | "createResponse" | "handleCacheHeaders"
> {}
