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
    const response = await fetch(`${serverURL}/subdir/api/proxy/todos/Package.todos.Entity.3`, {
      headers: {
        "sec-fetch-dest": "empty",
      },
      redirect: "manual",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("todos/Package.todos.Entity.3");
  });
});
