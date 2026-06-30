import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("openapi", () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./openapi-fixture", import.meta.url));

  beforeAll(async () => {
    server = await createServer({ root: rootDir });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as {
      port: number;
      address: string;
      family: string;
    };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  test("extracts defineRouteMeta", async () => {
    const res = await fetch(`${serverURL}/_openapi.json`);
    const spec: Record<string, any> = await res.json();

    expect(spec.openapi).toMatch(/^3\.\d+\.\d+$/);
    expect(spec.paths?.["/api/meta/test"]).toBeDefined();
    expect(spec.paths["/api/meta/test"].get.description).toBe("Vite builder route description");
    expect(spec.paths["/api/meta/test"].get.tags).toEqual(["test"]);

    const routeRes = await fetch(`${serverURL}/api/meta/test`);
    expect(routeRes.status).toBe(200);
    expect(await routeRes.json()).toEqual({ status: "OK" });
  });

  test("serves swagger UI with meta", async () => {
    const res = await fetch(`${serverURL}/_swagger`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>OpenAPI Test API</title>");
    expect(html).toContain('<meta name="description" content="OpenAPI Test Description"');
  });

  test("serves scalar UI with meta", async () => {
    const res = await fetch(`${serverURL}/_scalar`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>OpenAPI Test API</title>");
    expect(html).toContain('<meta name="description" content="OpenAPI Test Description"');
  });
});
