import { fileURLToPath } from "node:url";
import { build, createDevServer, createNitro, prepare } from "../../src/core";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  isTest: false,
  isCI: false,
}));

describe("nitro:dev:shutdown", () => {
  const rootDir = fileURLToPath(new URL("fixture", import.meta.url));
  let closeNitro: (() => Promise<void>) | undefined;

  afterAll(() => closeNitro?.());

  it("closes promptly with an open websocket connection", async () => {
    const nitro = await createNitro({
      rootDir,
      dev: true,
      preset: "nitro-dev",
      buildDir: fileURLToPath(new URL(".nitro", import.meta.url)),
      output: { dir: fileURLToPath(new URL(".output", import.meta.url)) },
    });
    closeNitro = () => nitro.close();
    const devServer = createDevServer(nitro);
    const server = await devServer.listen(0, { hostname: "127.0.0.1" });
    await prepare(nitro);
    const ready = new Promise<void>((resolve) => {
      nitro.hooks.hook("dev:reload", () => resolve());
    });
    await build(nitro);
    await ready;

    const ws = new WebSocket(server.url.replace(/^http/, "ws") + "_ws");
    const echo = await new Promise<string>((resolve, reject) => {
      ws.addEventListener("open", () => ws.send("ping"));
      ws.addEventListener("message", (e) => resolve(String(e.data)));
      ws.addEventListener("error", reject);
    });
    expect(echo).toBe("ping");

    const start = performance.now();
    await Promise.race([
      devServer.close(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("dev server close timed out")), 8000)
      ),
    ]);
    expect(performance.now() - start).toBeLessThan(2000);
    ws.close();
    await server.close();
  }, 30_000);
});
