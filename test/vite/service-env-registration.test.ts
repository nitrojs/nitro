import { fileURLToPath } from "node:url";
import { RunnerManager } from "env-runner";
import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

// #4638: the env runner announces the registered environments to the dev worker when it becomes
// ready, and the worker invokes an environment as soon as it hears about it. An environment
// announced before it is constructed drops the first invoke (`getBuiltins`) and SSR hangs; one
// announced before it is initialized fails `fetchModule` (no plugin container) and SSR errors.
// Whether the worker wins either race depends on machine timing, so it is made to win here: the
// environments are held until the worker has invoked every environment it was told about.
describe("vite: service environment registration", { concurrent: false }, () => {
  const rootDir = fileURLToPath(new URL("./service-env-registration-fixture", import.meta.url));
  const originalCwd = process.cwd();
  const originalReload = RunnerManager.prototype.reload;
  let server: ViteDevServer | undefined;

  afterEach(async () => {
    RunnerManager.prototype.reload = originalReload;
    delete (globalThis as any).__slowSsrInit;
    await server?.close();
    server = undefined;
    process.chdir(originalCwd);
  });

  test("ssr renders when the worker is ready before the environment is constructed", async () => {
    RunnerManager.prototype.reload = async function (this: RunnerManager, runner) {
      const settled = watchWorker(this);
      await originalReload.call(this, runner);
      await settled({ invokes: 1 });
    };
    const res = await fetchSSR();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Hello from SSR");
  });

  test("ssr renders when the worker is ready before the environment is initialized", async () => {
    RunnerManager.prototype.reload = async function (this: RunnerManager, runner) {
      const settled = watchWorker(this);
      (globalThis as any).__slowSsrInit = () => settled({ invokes: 2 });
      await originalReload.call(this, runner);
    };
    const res = await fetchSSR();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Hello from SSR");
  });

  async function fetchSSR() {
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    const host = addr.family === "IPv6" ? `[${addr.address}]` : addr.address;
    return fetch(`http://${host}:${addr.port}`, {
      headers: { "sec-fetch-dest": "document", accept: "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
  }
});

/**
 * Resolves once the runner is ready and the dev worker has sent `invokes` module runner invokes
 * for each environment announced to it by then.
 */
function watchWorker(manager: RunnerManager) {
  const announced = new Set<string>();
  const invoked = new Map<string, number>();
  let onInvoke: (() => void) | undefined;
  const sendMessage = manager.sendMessage;
  manager.sendMessage = (message: any) => {
    if (message?.event === "nitro:vite-env") announced.add(message.data.name);
    sendMessage.call(manager, message);
  };
  manager.onMessage((message: any) => {
    if (message?.event === "vite:invoke") {
      invoked.set(message.viteEnv, (invoked.get(message.viteEnv) || 0) + 1);
      onInvoke?.();
    }
  });
  return async ({ invokes }: { invokes: number }) => {
    await manager.waitForReady();
    manager.sendMessage = sendMessage;
    while ([...announced].some((name) => (invoked.get(name) || 0) < invokes)) {
      await new Promise<void>((resolve) => (onInvoke = resolve));
    }
  };
}
