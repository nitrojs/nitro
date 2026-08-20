import { afterEach, describe, expect, test, vi } from "vitest";

const { importEntry } = vi.hoisted(() => ({
  importEntry: vi.fn(),
}));

vi.mock("vite/module-runner", () => ({
  ESModulesEvaluator: class {},
  ModuleRunner: class {
    import(...args: unknown[]) {
      return importEntry(...args);
    }
  },
}));

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
    vi.restoreAllMocks();
    vi.clearAllMocks();
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
