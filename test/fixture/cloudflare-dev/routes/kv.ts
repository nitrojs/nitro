import { defineHandler } from "nitro";
import type { KVNamespace } from "@cloudflare/workers-types";

export default defineHandler(async (event) => {
  const kv = event.req.runtime!.cloudflare!.env.TEST_KV as KVNamespace;
  return { value: await kv.get("binding-test") };
});
