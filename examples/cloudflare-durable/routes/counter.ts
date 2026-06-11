import type { CounterDO } from "../server/durable/counter.ts";
import { defineHandler } from "nitro";

export default defineHandler(async (event) => {
  const env = event.req.runtime?.cloudflare?.env as {
    COUNTER: DurableObjectNamespace<CounterDO>;
  };
  const counter = env.COUNTER.getByName("global");
  const count = await counter.increment();
  return { count };
});
