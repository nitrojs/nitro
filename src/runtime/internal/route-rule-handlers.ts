// Nitro's `cache` rule handler for the compiled route-rules matcher (see
// `src/build/virtual/routing.ts`). The built-in handlers (`headers`, `redirect`,
// `proxy`, `basicAuth`, `cors`) are imported straight from `h3-rules` by the
// compiler's default preset; only `cache` is overridden here so it stays bound
// to Nitro's own cached-handler runtime, keeping Nitro's unstorage /
// `useStorage()` wiring and stable cache keys.
import { createCacheRuleHandler } from "h3-rules";
import { defineCachedHandler } from "./cache.ts";

// `/* @__PURE__ */` so an app that uses only non-cache rules (e.g. `headers`)
// tree-shakes this out along with `ocache`/`ohash` — importing `headers` from
// this module must not drag in the cache runtime.
export const cache = /* @__PURE__ */ createCacheRuleHandler({
  defineCachedHandler,
  // Preserve Nitro's cache storage key convention (`nitro/route-rules`) so
  // existing cache entries stay valid across the h3-rules migration.
  defaults: { group: "nitro/route-rules" },
});
