import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { parseSync } from "rolldown/utils";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer, version } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe.each([false, true])("vite:html template (bundledDev=%s)", (bundledDev) => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./html-template-fixture", import.meta.url));

  beforeAll(async () => {
    server = await createServer({
      root: rootDir,
      logLevel: "warn",
      experimental: { bundledDev },
      nitro: {
        vite: { path: import.meta.resolve(process.env.NITRO_VITE_PKG || "vite") },
      },
    });
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

  // Relative imports in inline `<style>` resolve against the template file, not the root dir.
  test.skipIf(bundledDev && Number(version.split(".")[0]) < 8)(
    "resolves relative imports in inline styles",
    async () => {
      const res = await fetch(serverURL, { headers: { accept: "text/html" } });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("<h1>html template</h1>");
      expect(html).toContain("rebeccapurple");
      expect(html).not.toContain('@import "./src/style.css"');
    }
  );

  test.skipIf(bundledDev && Number(version.split(".")[0]) < 8)(
    "serves the client scripts referenced by rendered HTML",
    async () => {
      const res = await fetch(serverURL, { headers: { accept: "text/html" } });
      expect(res.status).toBe(200);
      const html = await res.text();
      const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)];
      expect(scripts.length).toBeGreaterThan(0);
      for (const script of scripts) {
        const response = await fetch(new URL(script[1], serverURL));
        expect(response.status, script[1]).toBe(200);
        expect(parseSync("client.mjs", await response.text()).errors, script[1]).toEqual([]);
      }
    }
  );
});
