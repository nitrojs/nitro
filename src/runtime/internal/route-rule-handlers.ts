// Nitro's `cache` rule handler for the compiled route-rules matcher (see
// `src/build/virtual/routing.ts`). The built-in handlers (`headers`,
// `redirect`, `proxy`, `cors`) are imported straight from `h3/rules` by the
// compiler's default preset; only `cache` is overridden here so it stays bound
// to Nitro's cache storage (`cache` config), defaults and stable cache keys.
import type { RuleHandler } from "h3/rules";
import { createOcacheRuleHandler } from "h3/rules/cache";
import { FastResponse } from "srvx";
import { cacheHandlerDefaults } from "#nitro/virtual/cache";
import { cacheStorage, defaultOnError } from "./cache.ts";

// `/* @__PURE__ */` so an app that uses only non-cache rules (e.g. `headers`)
// tree-shakes this out along with `ocache`.
export const cache: RuleHandler<"cache"> = /* @__PURE__ */ createOcacheRuleHandler({
  storage: cacheStorage,
  defaults: {
    // Preserve Nitro's cache storage key convention (`nitro/route-rules`) so
    // existing cache entries stay valid.
    group: "nitro/route-rules",
    onError: defaultOnError,
    createResponse: (body, init) => new FastResponse(body as BodyInit, init),
    ...cacheHandlerDefaults,
  },
});
