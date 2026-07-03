import type { CounterDO } from "../server/durable/counter.ts";
import { defineHandler, HTTPError } from "nitro";

export default defineHandler(async (event) => {
  const env = event.req.runtime?.cloudflare?.env as
    | { COUNTER?: DurableObjectNamespace<CounterDO> }
    | undefined;
  if (!env?.COUNTER) {
    throw new HTTPError("Missing Cloudflare Durable Object binding: COUNTER", { status: 500 });
  }
  const counter = env.COUNTER.getByName("global");
  const count = await counter.increment();
  return { count };
});
