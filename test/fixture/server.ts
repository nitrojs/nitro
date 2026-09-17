import { defineServerEntry } from "nitro";
import { srvxPluginRuns } from "./server/utils/srvx-plugin.ts";

export default defineServerEntry({
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response("server entry works!");
    }
    return new Response("404 Not Found", { status: 404 });
  },
  // Passed to srvx (node, bun and deno servers)
  maxRequestBodySize: 64 * 1024,
  // Applied by all presets
  middleware: [
    (req, next) => {
      if (new URL(req.url).pathname === "/srvx-middleware") {
        return new Response("server entry middleware works!");
      }
      return next();
    },
  ],
  plugins: [
    (server) => {
      srvxPluginRuns.count++;
      server.options.middleware.unshift(async (req, next) => {
        const res = await next();
        if (new URL(req.url).pathname === "/srvx-middleware") {
          res.headers.append("x-srvx-plugin", "works");
        }
        return res;
      });
    },
  ],
});
