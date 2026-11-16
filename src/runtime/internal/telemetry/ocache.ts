import type { FUNCTION_CHANNEL, HANDLER_CHANNEL } from "ocache";

/**
 * Tracing channels published by `ocache` with its `tracing` option (its `HANDLER_CHANNEL` and
 * `FUNCTION_CHANNEL` exports).
 *
 * Copied rather than imported so tracing doesn't pull `ocache` into apps that don't cache.
 */
export const OCACHE_HANDLER_CHANNEL: typeof HANDLER_CHANNEL = "ocache.handler";

export const OCACHE_FUNCTION_CHANNEL: typeof FUNCTION_CHANNEL = "ocache.function";
