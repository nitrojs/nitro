import { fileURLToPath } from "node:url";
import { readFile, rm, writeFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";
import { build, createDevServer, createNitro, prepare } from "nitro/builder";
import { nitro as nitroVite } from "nitro/vite";
import type { NitroConfig } from "nitro/types";
import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { isWindows } from "std-env";

const { createServer, createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("../fixture/cloudflare-dev", import.meta.url));

// Dev reloads (a full rebuild with Rollup) can take longer than the default 1s poll timeout on CI
const reloadPoll = { timeout: 10_000 };

// Nitro dev server does not support the vite builder (use `vite dev`)
const skipNitroDev =
  process.env.NITRO_BUILDER === "vite" ||
  // TODO: rspack on Windows (https://github.com/nitrojs/nitro/issues/4948)
  (isWindows && process.env.NITRO_BUILDER === "rspack");

for (const mode of ["nitro", "vite", "build", "vite-build"] as const) {
  if (mode === "nitro" && skipNitroDev) continue;
  describe(`cloudflare bindings: ${mode}`, { concurrent: false }, () => {
    let fetchPath: (path: string) => Promise<Response>;
    let serverURL: string | undefined;
    let reload: (() => Promise<void>) | undefined;
    let close: () => Promise<void>;
    let warn: MockInstance | undefined;
    let bundlerWarnings: string[] = [];

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
        const consoleWarn = vi.spyOn(console, "warn");
        const server = createDevServer(nitro);
        await prepare(nitro);
        const ready = new Promise<void>((resolve) =>
          nitro.hooks.hook("dev:reload", () => resolve())
        );
        await build(nitro);
        await ready;
        bundlerWarnings = consoleWarn.mock.calls.map((args) => String(args[0]));
        consoleWarn.mockRestore();
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
        expect(wrangler.env.test.exports.Greeter).toEqual({ type: "worker" });
        expect(wrangler.env.test.workflows).toContainEqual({
          binding: "TEST_WORKFLOW",
          name: "doubler",
          class_name: "Doubler",
        });
        const mf = new Miniflare({
          modules: true,
          scriptPath: resolve(serverDir, "index.mjs"),
          compatibilityDate: "2026-07-01",
          compatibilityFlags: ["nodejs_compat"],
          bindings: { TEST_VAR: "configured", INLINE_VAR: "inline" },
          kvNamespaces: ["TEST_KV"],
          d1Databases: ["TEST_D1"],
          durableObjects: {
            TEST_COUNTER: { className: "Counter", useSQLite: true },
          },
          workflows: {
            TEST_WORKFLOW: { name: "doubler", className: "Doubler" },
          },
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

    it.runIf(mode === "nitro")("keeps workerd built-in modules external", () => {
      expect(bundlerWarnings.filter((w) => w.includes("cloudflare:workers"))).toEqual([]);
    });

    it("serves a Durable Object re-exported from the server entry", async () => {
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

    it("shares module state between routes and Durable Objects", async () => {
      for (const hits of [1, 2]) {
        const response = await fetchPath("/shared");
        const body = await response.text();
        expect(response.status, body).toBe(200);
        expect(JSON.parse(body)).toEqual({ route: hits, durableObject: hits });
      }
    });

    it("shares module state between routes and WorkerEntrypoints via ctx.exports", async () => {
      const response = await fetchPath("/greeter");
      const body = await response.text();
      expect(response.status, body).toBe(200);
      const { greeting, route, entrypoint } = JSON.parse(body);
      expect(greeting).toBe("hello nitro");
      expect(entrypoint).toBe(route);
    });

    it("runs a Workflow exported from the server entry", async () => {
      const response = await fetchPath("/workflow");
      const body = await response.text();
      expect(response.status, body).toBe(200);
      expect(JSON.parse(body)).toEqual({ status: "complete", output: 42 });
    });

    it("resolves Durable Object dependencies with the workerd condition", async () => {
      const response = await fetchPath("/counter?condition");
      expect(await response.json()).toEqual({ condition: "workerd" });
    });

    it("loads CommonJS dependencies with the workerd condition", async () => {
      const response = await fetchPath("/cjs");
      const body = await response.text();
      expect(response.status, body).toBe(200);
      expect(JSON.parse(body)).toEqual({ value: 42, runtime: "workerd" });
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
            .poll(async () => (await fetchPath("/counter")).json(), reloadPoll)
            .toEqual({ count: 2, reloaded: true });

          // The file watcher drops a change that follows the previous one within 50ms
          await waitForWatcher();

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
            .poll(async () => (await fetchPath("/counter")).json(), reloadPoll)
            .toEqual({ count: 2, extra: "fixed" });
        } finally {
          await writeFile(path, source);
          await rm(extraPath, { force: true });
          await expect
            .poll(async () => (await fetchPath("/counter")).json(), reloadPoll)
            .toEqual({ count: 2 });
        }
      }
    );

    it.runIf(mode === "nitro" || mode === "vite")("reloads WorkerEntrypoints", async () => {
      const path = resolve(rootDir, "greeter.ts");
      const source = await readFile(path, "utf8");
      const greeting = async () => ((await (await fetchPath("/greeter")).json()) as any).greeting;
      try {
        await writeFile(path, source.replace("hello", "hi"));
        await expect.poll(greeting, reloadPoll).toBe("hi nitro");
      } finally {
        await waitForWatcher();
        await writeFile(path, source);
        await expect.poll(greeting, reloadPoll).toBe("hello nitro");
      }
    });
  });
}

for (const mode of ["nitro", "vite"] as const) {
  if (mode === "nitro" && skipNitroDev) continue;
  for (const binding of [false, true]) {
    describe(`cloudflare-dev websocket: ${mode} (\`$DurableObject\` binding: ${binding})`, () => {
      let wsURL: URL;
      let close: () => Promise<void>;

      beforeAll(async () => {
        const config = {
          features: { websocket: true },
          handlers: [
            {
              route: "/_ws",
              handler: fileURLToPath(new URL("fixtures/websocket-pubsub.ts", import.meta.url)),
            },
          ],
          cloudflare: binding
            ? {
                wranglerEnv: "test",
                wrangler: {
                  name: "nitro-dev",
                  env: {
                    test: {
                      durable_objects: {
                        // `script_name` of the Worker itself (`<name>-<env>`) is a local binding
                        bindings: [
                          {
                            name: "$DurableObject",
                            class_name: "$DurableObject",
                            script_name: "nitro-dev-test",
                          },
                        ],
                      },
                    },
                  },
                },
              }
            : undefined,
        } satisfies NitroConfig;
        let serverURL: string;
        if (mode === "nitro") {
          const nitro = await createNitro({
            ...config,
            rootDir,
            dev: true,
            builder: (process.env.NITRO_BUILDER as "rollup" | "rolldown") || "rolldown",
          });
          const listener = createDevServer(nitro).listen({ port: 0, hostname: "127.0.0.1" });
          // Closes the listener and the runner together (the sockets stay open until the runner stops)
          close = () => nitro.close();
          await prepare(nitro);
          const ready = new Promise<void>((resolve) =>
            nitro.hooks.hook("dev:reload", () => resolve())
          );
          await build(nitro);
          await ready;
          await listener.ready();
          serverURL = listener.url!;
        } else {
          const server = await createServer({
            root: rootDir,
            configFile: false,
            logLevel: "warn",
            resolve: { alias: { "~vite-alias": rootDir } },
            plugins: [nitroVite(config)],
          });
          close = () => server.close();
          await server.listen(0);
          serverURL = server.resolvedUrls!.local[0];
        }
        wsURL = new URL("/_ws", serverURL.replace(/^http/, "ws"));
        // An upgrade sent while Miniflare starts can break its init
        await fetch(new URL("/bindings", serverURL));
      }, 60_000);

      afterAll(async () => {
        await close?.();
      });

      it("calls the route's hooks and publishes to peers only through the Durable Object", async () => {
        const [a, b] = await Promise.all([connect(wsURL), connect(wsURL)]);
        try {
          expect(await a.next()).toBe("ready");
          expect(await b.next()).toBe("ready");
          a.ws.send("hello");
          expect(await a.next()).toBe("sent");
          if (binding) {
            expect(await b.next()).toBe("pub:hello");
          } else {
            await expect(b.next(500)).rejects.toThrow("Timed out");
          }
          // Same Durable Object instance as the `cloudflare-module` entry
          a.ws.send("instance");
          expect(await a.next()).toBe(binding ? "instance:server" : "instance:undefined");
        } finally {
          a.ws.close();
          b.ws.close();
        }
      });
    });
  }
}

async function connect(url: URL) {
  const ws = new WebSocket(url);
  const queue: string[] = [];
  const waiters: ((message: string) => void)[] = [];
  ws.addEventListener("message", (event) => {
    const message = String(event.data);
    const waiter = waiters.shift();
    if (waiter) {
      waiter(message);
    } else {
      queue.push(message);
    }
  });
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("WebSocket error")));
  });
  const next = (timeout = 5000) =>
    queue.length > 0
      ? Promise.resolve(queue.shift()!)
      : new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Timed out")), timeout);
          waiters.push((message) => {
            clearTimeout(timer);
            resolve(message);
          });
        });
  return { ws, next };
}

function waitForWatcher() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}
