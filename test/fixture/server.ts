import { defineServerEntry } from "nitro";

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
  // Ignored: request handling options would only apply to srvx presets
  // @ts-expect-error
  middleware: [
    (req: Request, next: () => Response | Promise<Response>) => {
      if (new URL(req.url).pathname === "/srvx-middleware") {
        return new Response("server entry middleware works!");
      }
      return next();
    },
  ],
  plugins: [
    (server: any) => {
      server.options.middleware.unshift(async (req: Request, next: () => Promise<Response>) => {
        const res = await next();
        if (new URL(req.url).pathname === "/srvx-middleware") {
          res.headers.set("x-srvx-plugin", "works");
        }
        return res;
      });
    },
  ],
});
