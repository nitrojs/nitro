import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, createDevServer, createNitro, prepare } from "nitro/builder";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("../fixture/cloudflare-dev", import.meta.url));

for (const mode of ["nitro", "vite"] as const) {
  describe(`cloudflare dev bindings: ${mode}`, { sequential: true }, () => {
    let fetchRequest: (request: Request) => Promise<Response>;
    let close: () => Promise<void>;
    const originalCwd = process.cwd();

    beforeAll(async () => {
      process.chdir(rootDir);
      if (mode === "nitro") {
        const nitro = await createNitro({
          rootDir,
          dev: true,
          builder: (process.env.NITRO_BUILDER as "rollup" | "rolldown") || "rolldown",
        });
        close = () => nitro.close();
        const server = createDevServer(nitro);
        await prepare(nitro);
        const ready = new Promise<void>((resolve) =>
          nitro.hooks.hook("dev:reload", () => resolve())
        );
        await build(nitro);
        await ready;
        fetchRequest = (request) => Promise.resolve(server.fetch(request));
      } else {
        const server = await createServer({ root: rootDir, logLevel: "warn" });
        close = () => server.close();
        await server.listen(0);
        const url = server.resolvedUrls!.local[0];
        fetchRequest = (request) => fetch(new URL(new URL(request.url).pathname, url));
      }
    }, 60_000);

    afterAll(async () => {
      await close?.();
      process.chdir(originalCwd);
    });

    it("exposes KV, D1 and execution context from the selected Wrangler environment", async () => {
      const response = await fetchRequest(new Request("http://localhost/bindings"));
      const body = await response.text();
      expect(response.status, body).toBe(200);
      expect(JSON.parse(body)).toEqual({
        name: "cloudflare",
        value: "works",
        row: { value: 42 },
        variable: "configured",
        inlineVariable: "inline",
        waitUntil: "function",
      });
    });
  });
}
