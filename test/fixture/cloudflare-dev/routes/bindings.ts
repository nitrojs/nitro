import { defineHandler } from "nitro";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

export default defineHandler(async (event) => {
  const { env, context } = event.req.runtime!.cloudflare!;
  const db = env.TEST_D1 as D1Database;
  const kv = env.TEST_KV as KVNamespace;
  await kv.put("binding-test", "works");
  event.req.waitUntil!(Promise.resolve());
  return {
    name: event.req.runtime!.name,
    value: await kv.get("binding-test"),
    row: await db.prepare("SELECT 42 AS value").first(),
    variable: env.TEST_VAR,
    inlineVariable: env.INLINE_VAR,
    waitUntil: typeof context.waitUntil,
  };
});
