import type { QUERY_CHANNEL } from "db0/tracing";

/**
 * Tracing channel published by `db0/tracing` (its `QUERY_CHANNEL` export).
 *
 * Copied rather than imported so tracing doesn't make `db0` a dependency of apps that don't use a database.
 */
export const DB0_QUERY_CHANNEL: typeof QUERY_CHANNEL = "db0.query";
