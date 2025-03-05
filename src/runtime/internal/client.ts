import type { $Fetch, NitroFetchRequest } from "nitro/types";
// Client polyfill
import { $fetch } from "ofetch";

if (!globalThis.$fetch) {
  globalThis.$fetch = $fetch as $Fetch<unknown, NitroFetchRequest>;
}
