import { promises as fsp } from "node:fs";
import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";

import { setupTest, testNitro } from "../tests.ts";
import { testBuiltinImports } from "./_builtin-imports.ts";

const presetFixturesDir = resolve(import.meta.dirname, "fixtures");

describe("nitro:preset:cloudflare-module", async () => {
  const ctx = await setupTest("cloudflare-module", {
    config: {
      features: { websocket: true },
      handlers: [{ route: "/_ws", handler: resolve(presetFixturesDir, "websocket-pubsub.ts") }],
    },
  });

  testNitro(
    ctx,
    () => {
      const mf = new Miniflare({
        modules: true,
        compatibilityDate: "2025-04-01",
        scriptPath: resolve(ctx.outDir, "server/index.mjs"),
        modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
        assets: {
          directory: resolve(ctx.outDir, "public"),
          routerConfig: { has_user_worker: true },
          assetConfig: {
            // https://developers.cloudflare.com/workers/static-assets/routing/#routing-configuration
            html_handling: "auto-trailing-slash" /* default */,
            not_found_handling: "none" /* default */,
          },
        },
        compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
        bindings: { ...ctx.env },
      });

      return async ({ url, headers, method, body }) => {
        const res = await mf.dispatchFetch("http://localhost" + url, {
          headers: headers || {},
          method: method || "GET",
          redirect: "manual",
          body,
        });

        return res as unknown as Response;
      };
    },
    (_ctx, callHandler) => {
      it("serves embedded string/template data without rewriting it", async () => {
        const { data, status } = await callHandler({ url: "/embedded-kit" });
        expect(status).toBe(200);
        expect(data.keys).toEqual(["h3.mjs"]);
        // Embedded module text is data: it must come back byte for byte, in both
        // string and template form (https://github.com/nitrojs/nitro/issues/4526)
        expect(data.values[0]).toBe(
          "const _require = createRequire(import.meta.url);\nexport default _require;"
        );
        expect(data.source).toContain('import "node:fs";');
        expect(data.source).toContain("const _require = createRequire(import.meta.url);");
        expect(data.source).toContain("nitro4526marker");
        expect(data.escaped).toBe("<\\/script> quoted");
        // The real call site in the same chunk is guarded, so `createRequire` did
        // not throw on `import.meta.url` being undefined
        // (https://github.com/nitrojs/nitro/issues/4132)
        expect(data.require).toBe("function");
      });
    }
  );

  it("does not let the browser cache a missing public asset", async () => {
    const mf = new Miniflare({
      modules: true,
      compatibilityDate: "2025-04-01",
      scriptPath: resolve(ctx.outDir, "server/index.mjs"),
      modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      assets: {
        directory: resolve(ctx.outDir, "public"),
        binding: "ASSETS",
        routerConfig: { has_user_worker: true },
        assetConfig: { html_handling: "auto-trailing-slash", not_found_handling: "none" },
      },
      compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
      bindings: { ...ctx.env },
    });
    try {
      const found = await mf.dispatchFetch("http://localhost/build/test.txt");
      expect(found.status).toBe(200);
      expect(found.headers.get("cache-control")).toMatch(/max-age=3600/);

      const missing = await mf.dispatchFetch("http://localhost/build/missing.js");
      expect(missing.status).toBe(404);
      expect(missing.headers.get("cache-control")).toBe("no-store");
    } finally {
      await mf.dispose();
    }
  });

  testBuiltinImports(ctx);

  it("should export the correct functions", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "server", "index.mjs"), "utf8");
    expect(entry).toMatch(/export \{[^}]*myScheduled[^}]*\}/);
    expect(entry).toMatch(/export \{[^}]*\$DurableObject[^}]*\}/);
  });

  it("serves the app from the `$DurableObject` class when its binding is declared", async () => {
    const mf = new Miniflare({
      modules: true,
      compatibilityDate: "2025-04-01",
      scriptPath: resolve(ctx.outDir, "server/index.mjs"),
      modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
      durableObjects: { $DurableObject: "$DurableObject" },
      bindings: { ...ctx.env },
    });
    try {
      const namespace = await mf.getDurableObjectNamespace("$DurableObject");
      const stub = namespace.get(namespace.idFromName("server"));
      const res = await stub.fetch("http://localhost/api/hello");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Hello API" });
    } finally {
      await mf.dispose();
    }
  });

  it.each([
    { binding: true, received: ["ready", "pub:hi"] },
    { binding: false, received: ["ready"] },
  ])(
    "publishes WebSocket messages to peers only through the Durable Object (binding: $binding)",
    async ({ binding, received }) => {
      const mf = new Miniflare({
        modules: true,
        compatibilityDate: "2025-04-01",
        scriptPath: resolve(ctx.outDir, "server/index.mjs"),
        modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
        compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
        durableObjects: binding ? { $DurableObject: "$DurableObject" } : undefined,
        bindings: { ...ctx.env },
      });
      try {
        const url = new URL("/_ws", await mf.ready);
        url.protocol = "ws:";
        const a = await connectWebSocket(url);
        const b = await connectWebSocket(url);
        a.ws.send("hi");
        await a.next("sent");
        if (binding) {
          await b.next("pub:hi");
        } else {
          await expect(b.next("pub:hi", 500)).rejects.toThrow('Timed out waiting for "pub:hi"');
        }
        a.ws.send("instance");
        await a.next(binding ? "instance:server" : "instance:undefined");
        expect(b.messages).toEqual(received);
        a.ws.close();
        b.ws.close();
      } finally {
        await mf.dispose();
      }
    }
  );

  it("should auto-generate cron triggers in wrangler.json", async () => {
    const wranglerConfig = await fsp
      .readFile(resolve(ctx.outDir, "server", "wrangler.json"), "utf8")
      .then((r) => JSON.parse(r));
    expect(wranglerConfig.triggers).toEqual({
      crons: ["* * * * *"],
    });
  });

  it("does not rewrite createRequire or strip node imports inside string/template data", async () => {
    const serverDir = resolve(ctx.outDir, "server");
    const files = await fsp.readdir(serverDir, { recursive: true });
    const code = (
      await Promise.all(
        files
          .filter((f) => typeof f === "string" && f.endsWith(".mjs"))
          .map((f) => fsp.readFile(resolve(serverDir, f), "utf8"))
      )
    ).join("\n");
    // Embedded data is preserved...
    expect(code).toContain("const _require = createRequire(import.meta.url);");
    expect(code).toContain('import "node:fs";');
    expect(code).toContain("nitro4526marker");
    // ...while real call sites in the same chunks are still rewritten
    expect(code).toContain('createRequire(import.meta.url || "file:///")');
  });
});

async function connectWebSocket(url: URL) {
  const ws = new WebSocket(url);
  const messages: string[] = [];
  const waiters = new Map<string, () => void>();
  ws.addEventListener("message", (event) => {
    const data = String(event.data);
    messages.push(data);
    waiters.get(data)?.();
  });
  const next = (message: string, timeoutMs = 5000) =>
    messages.includes(message)
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`Timed out waiting for "${message}"`)),
            timeoutMs
          );
          waiters.set(message, () => {
            clearTimeout(timeout);
            resolve();
          });
        });
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("WebSocket connection failed")));
  });
  await next("ready");
  return { ws, messages, next };
}
