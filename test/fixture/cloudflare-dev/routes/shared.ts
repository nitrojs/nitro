import { defineHandler } from "nitro";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { shared } from "../shared.ts";

export default defineHandler(async (event) => {
  shared.hits++;
  const counter = event.req.runtime!.cloudflare!.env.TEST_COUNTER as DurableObjectNamespace;
  const response = await counter.get(counter.idFromName("test")).fetch("http://localhost/?shared");
  const { hits } = (await response.json()) as { hits: number };
  return { route: shared.hits, durableObject: hits };
});
