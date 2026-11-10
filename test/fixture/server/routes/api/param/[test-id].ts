import { defineRouteMeta } from "nitro";
import { defineHandler } from "nitro/h3";

defineRouteMeta({
  openAPI: {
    parameters: [{ in: "query", name: "format", schema: { type: "string" } }],
  },
});

export default defineHandler((event) => {
  event.res.headers.set("Content-Type", "text/plain; custom");
  return event.context.params!.test_id;
});
