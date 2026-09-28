import { fileURLToPath } from "node:url";
import { readFile, rm, writeFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";
import { build, createDevServer, createNitro, prepare } from "nitro/builder";
import { Miniflare } from "miniflare";
import { resolve } from "pathe";

const { createServer, createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("../fixture/cloudflare-dev", import.meta.url));

for (const mode of ["nitro", "vite", "build", "vite-build"] as const) {
  describe(`cloudflare bindings: ${mode}`, { concurrent: false }, () => {
    let fetchPath: (path: string) => Promise<Response>;
    let serverURL: string | undefined;
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
      } else if (mode === "vite") {
        const server = await createServer({ root: rootDir, logLevel: "warn" });
        close = () => server.close();
        await server.listen(0);
        serverURL = server.resolvedUrls!.local[0];
        fetchPath = (path) => fetch(new URL(path, serverURL));
      } else {
        let serverDir: string;
        if (mode === "vite-build") {
          const builder = await createBuilder({ root: rootDir, logLevel: "warn" });
          await builder.buildApp();
          serverDir = resolve(rootDir, ".output/server");
          close = async () => {};
        } else {
          const nitro = await createNitro({
            rootDir,
            builder: (process.env.NITRO_BUILDER as "rollup" | "rolldown") || "rolldown",
          });
          close = () => nitro.close();
          await prepare(nitro);
          await build(nitro);
          serverDir = nitro.options.output.serverDir;
        }
        const wrangler = JSON.parse(await readFile(resolve(serverDir, "wrangler.json"), "utf8"));
        expect(wrangler.env.test.durable_objects.bindings).toContainEqual({
          name: "TEST_COUNTER",
          class_name: "Counter",
        });
        expect(wrangler.env.test.exports.Counter).toEqual({
          type: "durable-object",
          storage: "sqlite",
        });
        const mf = new Miniflare({
          modules: true,
          scriptPath: resolve(serverDir, "index.mjs"),
          compatibilityDate: "2026-07-01",
          compatibilityFlags: ["nodejs_compat"],
          bindings: { TEST_VAR: "configured", INLINE_VAR: "inline" },
          kvNamespaces: ["TEST_KV"],
          d1Databases: ["TEST_D1"],
          durableObjects: { TEST_COUNTER: { className: "Counter", useSQLite: true } },
        });
        const closeNitro = close;
        close = async () => {
          await mf.dispose();
          await closeNitro();
        };
        fetchPath = async (path) => mf.dispatchFetch(new URL(path, "http://localhost")) as any;
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

    it("renders the index.html template", async () => {
      const response = await fetchPath("/");
      const body = await response.text();
      expect(response.status, body).toBe(200);
      expect(body).toContain("<h1>cloudflare-dev</h1>");
      if (mode === "vite") {
        expect(body).toContain("/@vite/client");
      }
    });

    it.runIf(mode === "nitro")("keeps binding state across reloads", async () => {
      await reload!();
      const response = await fetchPath("/kv");
      expect(await response.json()).toEqual({ value: "works" });
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("did not shut down"));
    });

    it("serves a Durable Object re-exported from exports.cloudflare.ts", async () => {
      for (const count of [1, 2]) {
        const response = await fetchPath("/counter?increment");
        const body = await response.text();
        expect(response.status, body).toBe(200);
        expect(JSON.parse(body)).toEqual({ count });
      }
      await reload?.();
      const response = await fetchPath("/counter");
      expect(await response.json()).toEqual({ count: 2 });
    });

    it.runIf(mode === "vite")(
      "upgrades WebSockets to a Durable Object without the websocket feature",
      async () => {
        const ws = new WebSocket(new URL("/counter", serverURL!.replace(/^http/, "ws")));
        const message = await new Promise<string>((resolve, reject) => {
          ws.addEventListener("open", () => ws.send("hello"));
          ws.addEventListener("message", (event) => resolve(String(event.data)));
          ws.addEventListener("error", () => reject(new Error("WebSocket error")));
          ws.addEventListener("close", (event) => reject(new Error(`Closed (${event.code})`)));
        }).finally(() => ws.close());
        expect(message).toBe("echo:hello");
      }
    );

    it("resolves Durable Object dependencies with the workerd condition", async () => {
      const response = await fetchPath("/counter?condition");
      expect(await response.json()).toEqual({ condition: "workerd" });
    });

    it.runIf(mode === "nitro" || mode === "vite")(
      "reloads Durable Object dependencies and preserves state",
      async () => {
        const path = resolve(rootDir, "counter.ts");
        const extraPath = resolve(rootDir, "counter-extra.ts");
        const source = await readFile(path, "utf8");
        try {
          await writeFile(path, source.replace("{ count }", "{ count, reloaded: true }"));
          await expect
            .poll(async () => (await fetchPath("/counter")).json())
            .toEqual({ count: 2, reloaded: true });

          // A new dependency (resolved with a Vite alias in Vite) recovers from a syntax error
          const extraId = mode === "vite" ? "~vite-alias/counter-extra.ts" : "./counter-extra.ts";
          await writeFile(extraPath, "export const extra = ;");
          await writeFile(
            path,
            `import { extra } from ${JSON.stringify(extraId)};\n` +
              source.replace("{ count }", "{ count, extra }")
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
          await writeFile(extraPath, `export const extra = "fixed";`);
          await expect
            .poll(async () => (await fetchPath("/counter")).json())
            .toEqual({ count: 2, extra: "fixed" });
        } finally {
          await writeFile(path, source);
          await rm(extraPath, { force: true });
          await expect.poll(async () => (await fetchPath("/counter")).json()).toEqual({ count: 2 });
        }
      }
    );
  });
}
