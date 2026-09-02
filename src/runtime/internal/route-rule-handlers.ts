// Nitro's `cache` rule handler for the compiled route-rules matcher (see
// `src/build/virtual/routing.ts`). The built-in handlers (`headers`,
// `redirect`, `proxy`, `cors`) are imported straight from `h3/rules` by the
// compiler's default preset; only `cache` is overridden here so it stays bound
// to Nitro's own cached-handler runtime, keeping Nitro's unstorage /
// `useStorage()` wiring and stable cache keys.
import { createCacheRuleHandler, type RuleHandler } from "h3/rules";
import { defineCachedHandler } from "./cache.ts";

// `/* @__PURE__ */` so an app that uses only non-cache rules (e.g. `headers`)
// tree-shakes this out along with `ocache`.
export const cache: RuleHandler<"cache"> = /* @__PURE__ */ createCacheRuleHandler({
  defineCachedHandler,
  // Preserve Nitro's cache storage key convention (`nitro/route-rules`) so
  // existing cache entries stay valid.
  defaults: { group: "nitro/route-rules" },
});
