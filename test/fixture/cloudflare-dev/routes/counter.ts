import { defineHandler } from "nitro";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";

export default defineHandler((event) => {
  const counter = event.req.runtime!.cloudflare!.env.TEST_COUNTER as DurableObjectNamespace;
  return counter.get(counter.idFromName("test")).fetch(event.req as any);
});
