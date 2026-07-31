import { fileURLToPath } from "node:url";
import type { Nitro } from "nitro/types";
import type { Plugin, ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:updateConfig", { sequential: true }, () => {
  let server: ViteDevServer;
  let serverURL: string;
  let nitro: Nitro;

  const rootDir = fileURLToPath(new URL("./app-fixture", import.meta.url));

  const capturePlugin: Plugin = {
    name: "capture-nitro",
    nitro: {
      setup(instance) {
        nitro = instance;
      },
    },
  };

  beforeAll(async () => {
    process.chdir(rootDir);
    server = await createServer({
      root: rootDir,
      plugins: [capturePlugin],
      server: { host: "127.0.0.1" },
    });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number };
    serverURL = `http://127.0.0.1:${addr.port}`;
    const res = await fetch(`${serverURL}/api/storage`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-extend")).toBe(null);
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  test("reflects updateConfig({ routeRules }) in dev", async () => {
    await nitro.updateConfig({
      routeRules: { "/api/storage": { headers: { "x-extend": "1" } } },
    });
    const header = await pollHeader(`${serverURL}/api/storage`, "x-extend");
    expect(header).toBe("1");
  });
});

function pollHeader(url: string, name: string, timeout = 5000): Promise<string | null> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url);
        await res.body?.cancel();
        const value = res.headers.get(name);
        if (value !== null || Date.now() - start > timeout) {
          resolve(value);
        } else {
          setTimeout(check, 100);
        }
      } catch (error) {
        reject(error);
      }
    };
    check();
  });
}
