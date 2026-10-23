import { fileURLToPath } from "node:url";
import type { InlineConfig, ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./websocket-hmr-fixture", import.meta.url));

// Nitro skipped every `vite-*` upgrade, so one on a path Vite does not claim (e.g. the HMR socket
// of an upstream Vite proxied by a route) was answered by nobody and hung forever.
describe.each<[string, InlineConfig["server"], string]>([
  ["default", {}, "/"],
  ["server.hmr: false", { hmr: false }, "/"],
  ["server.ws.path", { ws: { path: "/__hmr" } }, "/__hmr"],
])("vite:websocket-hmr (%s)", { concurrent: false }, (_, serverConfig, hmrBase) => {
  let server: ViteDevServer;
  let wsURL: string;

  beforeAll(async () => {
    server = await createServer({ root: rootDir, logLevel: "warn", server: serverConfig });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    wsURL = `ws://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  test("`vite-hmr` upgrade on a nitro route reaches nitro", async () => {
    expect(await firstMessage(`${wsURL}/ws`, "vite-hmr")).toEqual({
      protocol: "vite-hmr",
      message: "nitro",
      clean: true,
    });
  }, 30_000);

  test("`vite-hmr` upgrade on the HMR base is left to vite", async () => {
    expect(await firstMessage(`${wsURL}${hmrBase}`, "vite-hmr")).toEqual({
      protocol: "vite-hmr",
      message: JSON.stringify({ type: "connected" }),
      clean: true,
    });
  }, 30_000);
});

// Resolves with the first message, once the connection is closed again (cleanly unless another
// listener also answered the upgrade on the same socket).
function firstMessage(url: string, protocol: string) {
  return new Promise<{ protocol: string; message: string; clean: boolean }>((resolve, reject) => {
    const ws = new WebSocket(url, [protocol]);
    let message: string | undefined;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out waiting for a message from ${url}`));
    }, 20_000);
    ws.addEventListener("message", (event) => {
      message ??= String(event.data);
      setTimeout(() => ws.close(), 500);
    });
    ws.addEventListener("close", (event) => {
      clearTimeout(timer);
      if (message === undefined) {
        reject(new Error(`WebSocket connection to ${url} closed without a message`));
      } else {
        resolve({ protocol: ws.protocol, message, clean: event.wasClean });
      }
    });
  });
}
