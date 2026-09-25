import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import { addNetlifyVaryHeader } from "../../src/presets/netlify/runtime/_utils.ts";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as { port: number };
  return `http://127.0.0.1:${port}/`;
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("addNetlifyVaryHeader", () => {
  it("sets Netlify-Vary: query when Cache-Control has s-maxage", () => {
    const response = new Response("ok", {
      headers: { "Cache-Control": "max-age=60, s-maxage=60, stale-while-revalidate=86400" },
    });
    expect(addNetlifyVaryHeader(response).headers.get("Netlify-Vary")).toBe("query");
  });

  it("does not set Netlify-Vary when Cache-Control has no s-maxage", () => {
    const response = new Response("ok", {
      headers: { "Cache-Control": "public, max-age=3600, immutable" },
    });
    expect(addNetlifyVaryHeader(response).headers.has("Netlify-Vary")).toBe(false);
  });

  it("does not set Netlify-Vary when there is no Cache-Control header", () => {
    const response = new Response("ok");
    expect(addNetlifyVaryHeader(response).headers.has("Netlify-Vary")).toBe(false);
  });

  it("does not overwrite an existing Netlify-Vary header", () => {
    const response = new Response("ok", {
      headers: { "Cache-Control": "s-maxage=60", "Netlify-Vary": "query=icons" },
    });
    expect(addNetlifyVaryHeader(response).headers.get("Netlify-Vary")).toBe("query=icons");
  });

  // Regression test for a route handler that returns a fetched upstream Response
  // as-is (a passthrough/proxy handler): fetch() responses have immutable headers,
  // so `.set()` on them throws and addNetlifyVaryHeader must copy instead of
  // mutating in place (https://github.com/nitrojs/nitro/pull/4665).
  it("copies the response instead of mutating immutable (fetched) headers", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Cache-Control": "s-maxage=60" });
      res.end("upstream body");
    });
    const url = await listen(server);
    try {
      const upstreamResponse = await fetch(url);
      expect(() => upstreamResponse.headers.set("Netlify-Vary", "query")).toThrow();

      const result = addNetlifyVaryHeader(upstreamResponse);
      expect(result).not.toBe(upstreamResponse);
      expect(result.headers.get("Netlify-Vary")).toBe("query");
      expect(upstreamResponse.headers.has("Netlify-Vary")).toBe(false);
      await expect(result.text()).resolves.toBe("upstream body");
    } finally {
      await close(server);
    }
  });
});
