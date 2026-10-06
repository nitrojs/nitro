import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { joinURL } from "ufo";

const baseURL = process.env.NITRO_TEST_BASE_URL || "/";

const probe = (event: { url: URL }) => `probe:${event.url.pathname}`;

export default defineConfig({
  base: joinURL(baseURL, "_assets/"),
  plugins: [
    nitro({
      serverDir: "./",
      serveStatic: false,
      baseURL,
      devHandlers: [
        { route: joinURL(baseURL, "_assets/probe/**"), handler: probe },
        { route: joinURL(baseURL, "_probe/**"), handler: probe },
        {
          route: joinURL(baseURL, "_assets/missing/**"),
          handler: () => new Response("missing", { status: 404 }),
        },
        { route: joinURL(baseURL, "**"), handler: () => "catch-all" },
      ],
      devProxy: {
        [joinURL(baseURL, "_assets/upstream/**")]: { target: process.env.NITRO_TEST_UPSTREAM },
      },
    }),
  ],
});
