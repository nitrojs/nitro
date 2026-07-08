// Rule handlers for the compiled route-rules matcher (see
// `src/build/virtual/routing.ts`). Built-in handlers come from `h3-rules`; the
// `cache` handler is bound to Nitro's own cached-handler runtime so it keeps
// Nitro's unstorage / `useStorage()` wiring and stable cache keys.
import { createCacheRuleHandler } from "h3-rules";
import { defineCachedHandler } from "./cache.ts";

export { headers, redirect, proxy, basicAuth } from "h3-rules";

export const cache = createCacheRuleHandler({
  defineCachedHandler,
  // Preserve Nitro's cache storage key convention (`nitro/route-rules`) so
  // existing cache entries stay valid across the h3-rules migration.
  defaults: { group: "nitro/route-rules" },
});
