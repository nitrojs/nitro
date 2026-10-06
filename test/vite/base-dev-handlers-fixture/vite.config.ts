import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

const probe = (event: { url: URL }) => `probe:${event.url.pathname}`;

export default defineConfig({
  base: "/_assets/",
  plugins: [
    nitro({
      serverDir: "./",
      serveStatic: false,
      devHandlers: [
        { route: "/_assets/probe/**", handler: probe },
        { route: "/_probe/**", handler: probe },
        { route: "/**", handler: () => "catch-all" },
      ],
      devProxy: {
        "/_assets/upstream/**": { target: process.env.NITRO_TEST_UPSTREAM },
      },
    }),
  ],
});
