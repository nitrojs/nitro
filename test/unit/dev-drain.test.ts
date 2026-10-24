import type { Nitro, NitroConfig } from "nitro/types";
import { createHooks } from "hookable";
import { describe, expect, it, vi } from "vitest";

const runners = vi.hoisted(() => [] as FakeRunner[]);

vi.mock("env-runner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("env-runner")>()),
  loadRunner: async () => {
    const runner = new FakeRunner(runners.length);
    runners.push(runner);
    return runner;
  },
}));

vi.mock("../../src/build/info.ts", () => ({
  writeDevBuildInfo: async () => {},
}));

const { createDevServer } = await import("../../src/dev/server.ts");

describe("dev server drain", () => {
  it("closes the previous worker on reload by default", async () => {
    runners.length = 0;
    const { nitro, devServer } = createServer();
    await nitro.hooks.callHook("dev:reload");
    const res = await devServer.fetch(new Request("http://localhost/"));

    await nitro.hooks.callHook("dev:reload");
    await devServer.fetch(new Request("http://localhost/"));

    expect(runners).toHaveLength(2);
    expect(runners[0]!.shutdownMessages).toBe(1);
    expect(runners[0]!.closes).toBe(1);
    await expect(res.text()).rejects.toThrow();
    await devServer.close();
  });

  it("lets the previous worker finish in-flight responses with `devServer.drain`", async () => {
    runners.length = 0;
    const { nitro, devServer } = createServer({ drain: true });
    await nitro.hooks.callHook("dev:reload");
    const res = await devServer.fetch(new Request("http://localhost/"));

    await nitro.hooks.callHook("dev:reload");
    const next = await devServer.fetch(new Request("http://localhost/"));
    expect(next.headers.get("x-runner")).toBe("1");

    const [previous] = runners;
    expect(previous!.shutdownMessages).toBe(0);
    expect(previous!.closes).toBe(0);
    expect(previous!.shutdowns).toBe(0);

    previous!.end();
    expect(await res.text()).toBe("hello");
    await vi.waitFor(() => expect(previous!.shutdowns).toBe(1));
    expect(previous!.closes).toBe(0);
    await devServer.close();
  });

  it("shuts down draining workers gracefully on close", async () => {
    runners.length = 0;
    const { nitro, devServer } = createServer({ drain: true });
    await nitro.hooks.callHook("dev:reload");
    await devServer.fetch(new Request("http://localhost/"));

    await nitro.hooks.callHook("dev:reload");
    await devServer.fetch(new Request("http://localhost/"));
    await devServer.close();

    expect(runners[0]!.shutdowns).toBe(1);
    expect(runners[0]!.closes).toBe(0);
  });
});

function createServer(devServer: NitroConfig["devServer"] = {}) {
  const nitro = {
    logger: { info() {}, warn() {}, error() {} },
    hooks: createHooks(),
    options: {
      rootDir: "/app/",
      buildDir: "/app/.nitro/",
      baseURL: "/",
      output: { dir: "/app/.output", serverDir: "server" },
      devServer: { watch: [], devtoolsJson: false, runner: "node-worker", ...devServer },
      devHandlers: [],
      publicAssets: [],
      devProxy: {},
    },
  } as unknown as Nitro;
  return { nitro, devServer: createDevServer(nitro) };
}

class FakeRunner {
  ready = true;
  closed = false;
  address = { host: "127.0.0.1", port: 1 };
  shutdownMessages = 0;
  shutdowns = 0;
  closes = 0;
  #listeners = new Set<(message: unknown) => void>();
  #streams = new Set<ReadableStreamDefaultController<Uint8Array>>();

  readonly id: number;

  constructor(id: number) {
    this.id = id;
  }

  fetch = async () => {
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.#streams.add(controller);
      },
    });
    return new Response(body, { headers: { "x-runner": String(this.id) } });
  };

  end() {
    for (const controller of this.#streams) {
      controller.enqueue(new TextEncoder().encode("hello"));
      controller.close();
    }
    this.#streams.clear();
  }

  onMessage(listener: (message: unknown) => void) {
    this.#listeners.add(listener);
  }

  offMessage(listener: (message: unknown) => void) {
    this.#listeners.delete(listener);
  }

  sendMessage(message: any) {
    if (message?.event === "shutdown") {
      this.shutdownMessages++;
      queueMicrotask(() => {
        for (const listener of this.#listeners) {
          listener({ event: "exit" });
        }
      });
    }
  }

  async shutdown() {
    this.shutdowns++;
    this.closed = true;
  }

  async close() {
    this.closes++;
    this.closed = true;
    for (const controller of this.#streams) {
      controller.error(new Error("closed"));
    }
    this.#streams.clear();
  }
}
