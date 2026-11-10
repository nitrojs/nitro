import { defineHandler } from "nitro";
import { shared } from "../shared.ts";

export default defineHandler(async (event) => {
  shared.hits++;
  const { Greeter } = (event.req.runtime!.cloudflare!.context as any).exports;
  const { greeting, hits } = await Greeter.greet("nitro");
  return { greeting, route: shared.hits, entrypoint: hits };
});
