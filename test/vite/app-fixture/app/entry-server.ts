import { HTTPError } from "h3";
import { useStorage } from "nitro/storage";
import { useRuntimeConfig } from "nitro/runtime-config";

export default {
  async fetch(req: Request) {
    if (req.url.includes("?error")) {
      throw new HTTPError({ status: 418, headers: { "x-test": "123" } });
    }
    const pathname = new URL(req.url).pathname;
    if (pathname === "/dynamic-asset.png") {
      return new Response("PNGDATA", { headers: { "content-type": "image/png" } });
    }
    if (pathname.startsWith("/api-json/")) {
      return Response.json({ path: pathname });
    }
    if (/\.[a-z0-9]+$/i.test(pathname)) {
      // Naive SSR shape: render an HTML page for any unmatched path, extensioned or not.
      return new Response(`<!doctype html><h1>${pathname}</h1>`, {
        headers: { "content-type": "text/html" },
      });
    }
    const storage = useStorage();
    const config = useRuntimeConfig();
    await storage.set("test:key", "value-from-ssr");
    const value = await storage.get("test:key");
    return Response.json({
      storage: value,
      config: config.nitro?.envPrefix ?? "NITRO_",
    });
  },
};
