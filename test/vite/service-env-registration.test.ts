import { fileURLToPath } from "node:url";
import { RunnerManager } from "env-runner";
import type { ViteDevServer } from "vite";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

// #4638: the env runner announces the registered environments to the dev worker when it becomes
// ready. A service environment announced before it is constructed has no listener for the
// worker's first module runner invoke (`getBuiltins`), which is dropped, and SSR never comes up.
// Whether the worker wins that race depends on machine timing, so it is made to win here: the
// environments only get the runner once it is ready and has sent the invokes of the environments
// it was told about.
describe("vite: service environment registration", { concurrent: false }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./service-env-registration-fixture", import.meta.url));
  const originalCwd = process.cwd();
  const originalReload = RunnerManager.prototype.reload;

  beforeAll(async () => {
    RunnerManager.prototype.reload = async function (this: RunnerManager, runner) {
      let announced = 0;
      let invoked = 0;
      let onInvoked: () => void;
      const allInvoked = new Promise<void>((resolve) => (onInvoked = resolve));
      const sendMessage = this.sendMessage;
      this.sendMessage = (message: any) => {
        if (message?.event === "nitro:vite-env") announced++;
        sendMessage.call(this, message);
      };
      const listener = (message: any) => {
        if (message?.event === "vite:invoke" && ++invoked === announced) onInvoked();
      };
      this.onMessage(listener);
      try {
        await originalReload.call(this, runner);
        await this.waitForReady();
        this.sendMessage = sendMessage;
        if (announced > 0) await allInvoked;
      } finally {
        this.sendMessage = sendMessage;
        this.offMessage(listener);
      }
    };
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as {
      port: number;
      address: string;
      family: string;
    };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    RunnerManager.prototype.reload = originalReload;
    await server?.close();
    process.chdir(originalCwd);
  });

  test("ssr service renders when the worker invokes before the environment exists", async () => {
    const res = await fetch(serverURL, {
      headers: { "sec-fetch-dest": "document", accept: "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Hello from SSR");
  });
});
