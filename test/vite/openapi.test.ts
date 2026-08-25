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
    server = await createServer({ root: rootDir, logLevel: "warn" });
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
    expect(spec.paths["/api/meta/test"].get.parameters).toEqual([
      { in: "query", name: "vite-test", required: true },
    ]);
    expect(spec.paths["/api/meta/test"].get.responses).toEqual({
      200: { description: "result" },
    });

    const routeRes = await fetch(`${serverURL}/api/meta/test`);
    expect(routeRes.status).toBe(200);
    expect(await routeRes.json()).toEqual({ status: "OK" });
  });

  test("generates schemas for validated handlers", async () => {
    const spec: Record<string, any> = await fetch(`${serverURL}/_openapi.json`).then((res) =>
      res.json()
    );
    const operation = spec.paths["/api/users"].post;

    expect(operation.description).toBe("Creates a user");
    expect(operation.tags).toEqual(["users"]);
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "query",
          name: "notify",
          required: false,
          schema: expect.objectContaining({ enum: ["yes", "no"] }),
        }),
        expect.objectContaining({
          in: "header",
          name: "x-api-key",
          required: true,
          schema: expect.objectContaining({ type: "string" }),
        }),
      ])
    );
    expect(operation.requestBody.content["application/json"].schema).toEqual(
      expect.objectContaining({
        type: "object",
        required: ["name"],
        properties: {
          name: expect.objectContaining({ type: "string", minLength: 1 }),
          age: expect.objectContaining({ type: "integer" }),
        },
      })
    );
    expect(operation.responses[200].content["application/json"].schema).toEqual({
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        active: { type: "boolean" },
        role: { type: "string", enum: ["admin", "user"] },
      },
      required: ["id", "name", "role"],
    });

    const invalidResponse = await fetch(`${serverURL}/api/users`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({ name: "" }),
    });
    expect(invalidResponse.status).toBe(400);

    const response = await fetch(`${serverURL}/api/users?notify=yes`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({ name: "Ada" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "user-1", name: "Ada", role: "user" });
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
