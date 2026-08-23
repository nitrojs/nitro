import { defineConfig } from "nitro";

export default defineConfig({
  preset: "static",
  prerender: { routes: ["/について"] },
  // Points to an ASCII-named handler file; the route pattern itself is the literal
  // non-ASCII text.
  handlers: [{ route: "/について", handler: "./routes/nonascii.ts", method: "GET" }],
});
