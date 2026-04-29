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
    for (const fetchDest of ["empty", "document", undefined]) {
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

  // Browsers omit Sec-Fetch-* on plain-HTTP non-loopback origins (e.g. http://10.0.0.x:3000). Without that signal, a splat Nitro route would swallow `<script src=".../entry-client.ts">` requests. Accept + asset extension is used as a fallback to keep asset loads routed to Vite.
  test("does not misroute asset loads to splat Nitro routes when sec-fetch-dest is absent", async () => {
    const response = await fetch(`${serverURL}/subdir/api/proxy/entry-client.ts`, {
      headers: { accept: "*/*" },
      redirect: "manual",
    });
    expect(await response.text()).not.toBe("entry-client.ts");
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
