import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";
import { build, createDevServer, createNitro, prepare } from "nitro/builder";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("../fixture/cloudflare-dev", import.meta.url));

for (const mode of ["nitro", "vite"] as const) {
  describe(`cloudflare dev bindings: ${mode}`, { sequential: true }, () => {
    let fetchPath: (path: string) => Promise<Response>;
    let reload: (() => Promise<void>) | undefined;
    let close: () => Promise<void>;
    let warn: MockInstance | undefined;

    beforeAll(async () => {
      await rm(`${rootDir}/.wrangler`, { recursive: true, force: true });
      if (mode === "nitro") {
        const nitro = await createNitro({
          rootDir,
          dev: true,
          builder: (process.env.NITRO_BUILDER as "rollup" | "rolldown") || "rolldown",
        });
        close = () => nitro.close();
        warn = vi.spyOn(nitro.logger, "warn");
        const server = createDevServer(nitro);
        await prepare(nitro);
        const ready = new Promise<void>((resolve) =>
          nitro.hooks.hook("dev:reload", () => resolve())
        );
        await build(nitro);
        await ready;
        fetchPath = async (path) => server.fetch(new Request(new URL(path, "http://localhost")));
        reload = async () => {
          await nitro.hooks.callHook("dev:reload");
        };
      } else {
        const server = await createServer({ root: rootDir, logLevel: "warn" });
        close = () => server.close();
        await server.listen(0);
        const url = server.resolvedUrls!.local[0];
        fetchPath = (path) => fetch(new URL(path, url));
      }
    }, 60_000);

    afterAll(async () => {
      await close?.();
    });

    it("exposes KV, D1 and execution context from the selected Wrangler environment", async () => {
      const response = await fetchPath("/bindings");
      const body = await response.text();
      expect(response.status, body).toBe(200);
      expect(JSON.parse(body)).toEqual({
        name: "cloudflare",
        value: "works",
        row: { value: 42 },
        variable: "configured",
        inlineVariable: "inline",
      });
    });

    it.runIf(mode === "nitro")("keeps binding state across reloads", async () => {
      await reload!();
      const response = await fetchPath("/kv");
      expect(await response.json()).toEqual({ value: "works" });
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("did not shut down"));
    });
  });
}
