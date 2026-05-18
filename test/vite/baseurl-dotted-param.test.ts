import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:baseURL dotted params", { sequential: true }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./baseurl-dotted-param-fixture", import.meta.url));

  beforeAll(async () => {
    process.chdir(rootDir);
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

  test("serves Nitro API routes with dotted params under baseURL without redirecting", async () => {
    for (const fetchDest of ["empty", "document", "image", undefined]) {
      const headers: Record<string, string> = {};
      if (fetchDest) {
        headers["sec-fetch-dest"] = fetchDest;
      }
      const response = await fetch(`${serverURL}/subdir/api/proxy/todos/Package.todos.Entity.3`, {
        headers,
        redirect: "manual",
      });

      expect(response.status, `sec-fetch-dest: ${fetchDest}`).toBe(200);
      expect(response.headers.get("location"), `sec-fetch-dest: ${fetchDest}`).toBeNull();
      expect(await response.text(), `sec-fetch-dest: ${fetchDest}`).toBe(
        "todos/Package.todos.Entity.3"
      );
    }
  });

  // #4241: `<img src="/api/image">` sends `sec-fetch-dest: image`. The URL has no extension but matches an explicit Nitro splat route, so it must reach Nitro instead of being treated as a Vite asset load.
  test("routes extensionless URLs matching a Nitro route to Nitro even when sec-fetch-dest tags the request as an asset", async () => {
    const response = await fetch(`${serverURL}/subdir/api/proxy/image`, {
      headers: { "sec-fetch-dest": "image", accept: "image/*" },
      redirect: "manual",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("image");
  });

  test("prefixed splat routes win over Vite assets even with asset extensions and sec-fetch-dest", async () => {
    for (const fetchDest of ["script", "style", "image", undefined]) {
      const headers: Record<string, string> = { accept: "*/*" };
      if (fetchDest) {
        headers["sec-fetch-dest"] = fetchDest;
      }
      const response = await fetch(`${serverURL}/subdir/api/proxy/entry-client.ts`, {
        headers,
        redirect: "manual",
      });
      expect(response.status, `fetchDest: ${fetchDest}`).toBe(200);
      expect(await response.text(), `fetchDest: ${fetchDest}`).toBe("entry-client.ts");
    }
  });

  test("root-level wildcards do not swallow Vite assets (protects #4234)", async () => {
    for (const fetchDest of ["script", "style", "image", undefined]) {
      const headers: Record<string, string> = { accept: "*/*" };
      if (fetchDest) {
        headers["sec-fetch-dest"] = fetchDest;
      }
      const response = await fetch(`${serverURL}/subdir/entry-client.ts`, {
        headers,
        redirect: "manual",
      });
      expect(response.status, `fetchDest: ${fetchDest}`).toBe(404);
    }
  });

  test("root-level wildcards *do* swallow Vite assets when NOT an asset extension", async () => {
    const response = await fetch(`${serverURL}/subdir/some-page`, {
      redirect: "manual",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("root-wildcard:some-page");
  });

  test("ignores asset-like extensions inside the query string when routing to Nitro", async () => {
    const response = await fetch(`${serverURL}/subdir/api/proxy/data?file=bar.png`, {
      headers: { "sec-fetch-dest": "image", accept: "image/*" },
      redirect: "manual",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("data");
  });

  test("navigation without sec-fetch-dest still routes to Nitro (Accept: text/html)", async () => {
    const response = await fetch(`${serverURL}/subdir/api/proxy/page.html`, {
      headers: { accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("page.html");
  });
});
