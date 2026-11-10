import { connect, type Socket } from "node:net";
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

  it("does not leak a rejection when a proxied websocket dies", async () => {
    const nitro = await createNitro({
      rootDir,
      dev: true,
      preset: "nitro-dev",
      buildDir: fileURLToPath(new URL(".nitro/abort", import.meta.url)),
      output: {
        dir: fileURLToPath(new URL(".output/abort", import.meta.url)),
      },
    });
    const devServer = createDevServer(nitro);
    const server = await devServer.listen(0, { hostname: "127.0.0.1" });
    const port = Number(new URL(server.url).port);
    await prepare(nitro);
    const ready = new Promise<void>((resolve) => {
      nitro.hooks.hook("dev:reload", () => resolve());
    });
    await build(nitro);
    await ready;

    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      // Client resets an established websocket.
      for (let i = 0; i < 3; i++) {
        const socket = await openRawWebSocket(port, "/_ws");
        socket.resetAndDestroy();
      }

      // Worker is replaced while a websocket is proxied to it.
      const socket = await openRawWebSocket(port, "/_ws");
      const closed = new Promise((resolve) => socket.once("close", resolve));
      devServer.reload();
      await closed;

      // Build is broken, so there is no worker: answered with a 503.
      await nitro.hooks.callHook("dev:error", new Error("build failed"));
      await expect(openRawWebSocket(port, "/_ws")).rejects.toThrow(
        "HTTP/1.1 503"
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
      await devServer.close();
      await nitro.close();
    }
  }, 30_000);

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

function openRawWebSocket(port: number, path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1");
    socket.on("error", () => {});
    socket.once("connect", () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n` +
          "Connection: Upgrade\r\nUpgrade: websocket\r\n" +
          "Sec-WebSocket-Version: 13\r\n" +
          "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"
      );
    });
    socket.once("data", (data) => {
      if (String(data).startsWith("HTTP/1.1 101")) {
        resolve(socket);
      } else {
        socket.destroy();
        reject(new Error(`Upgrade failed: ${String(data).split("\r\n")[0]}`));
      }
    });
  });
}
