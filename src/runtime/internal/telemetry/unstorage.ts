import type { TracingChannelName } from "unstorage/tracing";

/**
 * Tracing channels published by `unstorage/tracing` (its `TRACING_CHANNELS` export).
 *
 * Copied rather than imported so tracing doesn't make `unstorage` a dependency of apps that don't use KV.
 */
export const UNSTORAGE_CHANNELS: readonly TracingChannelName[] = [
  "unstorage.hasItem",
  "unstorage.getItem",
  "unstorage.setItem",
  "unstorage.setItems",
  "unstorage.removeItem",
  "unstorage.getKeys",
  "unstorage.getItems",
  "unstorage.getItemRaw",
  "unstorage.setItemRaw",
  "unstorage.clear",
];
