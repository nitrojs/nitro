import { afterEach, describe, expect, test, vi } from "vitest";

const { importEntry } = vi.hoisted(() => ({
  importEntry: vi.fn(),
}));

// `vite` is resolved from the app: the generated entry injects the module runner (see
// `src/build/vite/_dev-worker.ts`).
const moduleRunner = {
  ESModulesEvaluator: class {},
  ModuleRunner: class {
    import(...args: unknown[]) {
      return importEntry(...args);
    }
  },
};

vi.mock("env-runner/vite", () => ({
  createViteTransport: vi.fn(() => ({})),
}));

const entry = (value: string) => ({
  default: { fetch: () => new Response(value) },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function createWorker() {
  importEntry.mockResolvedValueOnce(entry("v1"));
  const worker = await import("../../src/runtime/internal/vite/dev-worker.mjs");
  worker.setModuleRunner(moduleRunner);
  worker.ipc.onMessage({
    type: "custom",
    event: "nitro:vite-env",
    data: { name: "nitro", entry: "/entry.mjs" },
  });
  await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(1));
  return worker;
}

describe("Vite dev worker reloads", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
    delete (globalThis as any).__nitro_vite_envs__;
  });

  test("waits for an in-flight reload before fetching", async () => {
    const worker = await createWorker();
    const reload = deferred<ReturnType<typeof entry>>();
    importEntry.mockReturnValueOnce(reload.promise);

    worker.ipc.onMessage({ type: "full-reload" });
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(2));

    const response = worker.fetch(new Request("http://localhost"));
    reload.resolve(entry("v2"));

    expect(await (await response).text()).toBe("v2");
  });

  test("serializes overlapping reloads", async () => {
    const worker = await createWorker();
    const olderReload = deferred<ReturnType<typeof entry>>();
    const newerReload = deferred<ReturnType<typeof entry>>();
    importEntry.mockReturnValueOnce(olderReload.promise).mockReturnValueOnce(newerReload.promise);

    worker.ipc.onMessage({ type: "full-reload" });
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(2));
    worker.ipc.onMessage({ type: "full-reload" });

    expect(importEntry).toHaveBeenCalledTimes(2);

    const response = worker.fetch(new Request("http://localhost"));
    olderReload.resolve(entry("v2"));
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(3));
    newerReload.resolve(entry("v3"));

    expect(await (await response).text()).toBe("v3");
    expect(await (await worker.fetch(new Request("http://localhost"))).text()).toBe("v3");
  });

  test("waits for a reload queued while fetch is pending", async () => {
    const worker = await createWorker();
    const activeReload = deferred<ReturnType<typeof entry>>();
    const queuedReload = deferred<ReturnType<typeof entry>>();
    importEntry.mockReturnValueOnce(activeReload.promise).mockReturnValueOnce(queuedReload.promise);

    worker.ipc.onMessage({ type: "full-reload" });
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(2));
    const response = worker.fetch(new Request("http://localhost"));

    worker.ipc.onMessage({ type: "full-reload" });
    activeReload.resolve(entry("v2"));
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(3));
    queuedReload.resolve(entry("v3"));

    expect(await (await response).text()).toBe("v3");
  });

  test("coalesces reloads queued behind an in-flight reload", async () => {
    const worker = await createWorker();
    const inFlight = deferred<ReturnType<typeof entry>>();
    const queued = deferred<ReturnType<typeof entry>>();
    importEntry.mockReturnValueOnce(inFlight.promise).mockReturnValueOnce(queued.promise);

    worker.ipc.onMessage({ type: "full-reload" });
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(2));

    worker.ipc.onMessage({ type: "full-reload" });
    worker.ipc.onMessage({ type: "full-reload" });
    worker.ipc.onMessage({ type: "full-reload" });

    const response = worker.fetch(new Request("http://localhost"));
    inFlight.resolve(entry("v2"));
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(3));
    queued.resolve(entry("v3"));

    expect(await (await response).text()).toBe("v3");
    expect(importEntry).toHaveBeenCalledTimes(3);
  });

  test("reloads only the environment a tagged full-reload came from", async () => {
    const worker = await createWorker();
    importEntry.mockResolvedValueOnce(entry("ssr-v1"));
    worker.ipc.onMessage({
      type: "custom",
      event: "nitro:vite-env",
      data: { name: "ssr", entry: "/ssr.mjs" },
    });
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(2));

    importEntry.mockResolvedValueOnce(entry("ssr-v2"));
    worker.ipc.onMessage({ type: "full-reload", viteEnv: "ssr" });
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(3));
    expect(importEntry).toHaveBeenLastCalledWith("/ssr.mjs");

    const ssrRequest = new Request("http://localhost", { headers: { "x-vite-env": "ssr" } });
    expect(await (await worker.fetch(ssrRequest)).text()).toBe("ssr-v2");
    expect(await (await worker.fetch(new Request("http://localhost"))).text()).toBe("v1");
    expect(importEntry).toHaveBeenCalledTimes(3);
  });

  test("falls back to the previous entry when a reload never settles", async () => {
    const worker = await createWorker();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    importEntry.mockReturnValueOnce(new Promise(() => {}));

    worker.ipc.onMessage({ type: "full-reload" });
    await vi.waitFor(() => expect(importEntry).toHaveBeenCalledTimes(2));

    vi.useFakeTimers();
    const response = worker.fetch(new Request("http://localhost"));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(await (await response).text()).toBe("v1");
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  test("recovers after a failed reload", async () => {
    const worker = await createWorker();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    importEntry.mockRejectedValueOnce(new Error("reload failed"));

    worker.ipc.onMessage({ type: "full-reload" });
    const failedResponse = await worker.fetch(
      new Request("http://localhost", { headers: { accept: "application/json" } })
    );

    expect(failedResponse.status).toBe(500);
    expect(await failedResponse.json()).toMatchObject({ message: "reload failed" });

    importEntry.mockResolvedValueOnce(entry("v2"));
    worker.ipc.onMessage({ type: "full-reload" });

    expect(await (await worker.fetch(new Request("http://localhost"))).text()).toBe("v2");
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
