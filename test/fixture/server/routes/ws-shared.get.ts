import { defineHandler, defineRouteMeta } from "nitro";

defineRouteMeta({
  openAPI: { description: "HTTP" },
});

export default defineHandler(() => "http");
