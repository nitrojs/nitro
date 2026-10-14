import net from "node:net";
import crypto from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { createNitro } from "../../src/nitro.ts";
import { nitro as nitroPlugin } from "../../src/vite.ts";

// Raw WebSocket upgrade probe. Resolves with the HTTP status line (e.g.
// "HTTP/1.1 101 Switching Protocols") and rejects on timeout — modeling a
// socket that nobody completes the handshake for (the bug being fixed).
function probeUpgrade(host: string, port: number, path: string, protocol?: string) {
  const hostHeader = host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`;
  return new Promise<string>((resolve, reject) => {
    const socket = net.connect(port, host, () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\n` +
          `Host: ${hostHeader}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString("base64")}\r\n` +
          (protocol ? `Sec-WebSocket-Protocol: ${protocol}\r\n` : "") +
          `\r\n`
      );
    });
    let buf = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("pending: upgrade was never answered"));
    }, 10_000);
    socket.on("data", (chunk) => {
      buf += chunk.toString("latin1");
      if (buf.includes("\r\n\r\n")) {
        clearTimeout(timer);
        socket.destroy();
        resolve(buf.split("\r\n", 1)[0]);
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

describe("vite dev websocket upgrade routing", () => {
  let rootDir: string;
  let viteServer: ViteDevServer;
  let host: string;
  let port: number;

  beforeAll(async () => {
    // Temp app inside the repo so `nitro` (self-link) resolves from root node_modules.
    rootDir = await mkdtemp(join(fileURLToPath(new URL(".", import.meta.url)), ".tmp-vite-ws-"));
    await mkdir(join(rootDir, "routes"), { recursive: true });
    // A WebSocket handler on a non-HMR path (`/socket`). Mimics a Nitro route
    // that reverse-proxies an upstream Vite dev server: the upstream's HMR
    // client connects with the `vite-hmr` subprotocol on a path that is not the
    // outer Vite's HMR base, so the upgrade must reach Nitro rather than being
    // skipped as if it were the outer Vite's own HMR socket.
    await writeFile(
      join(rootDir, "routes", "socket.ts"),
      `import { defineWebSocketHandler } from "nitro";\n` +
        `export default defineWebSocketHandler({\n` +
        `  upgrade(req) {\n` +
        `    const protocol = req.headers.get("sec-websocket-protocol");\n` +
        `    return protocol ? { headers: { "sec-websocket-protocol": protocol } } : undefined;\n` +
        `  },\n` +
        `  open(peer) { peer.send("open"); },\n` +
        `  message(peer, message) { if (message.text().includes("ping")) peer.send("pong"); },\n` +
        `});\n`
    );

    const nitro = await createNitro(
      { dev: true, rootDir, builder: "vite", features: { websocket: true } },
      { compatibilityDate: "2025-01-01" }
    );

    viteServer = await createServer({
      root: rootDir,
      logLevel: "warn",
      plugins: [nitroPlugin({ _nitro: nitro })],
    });
    await viteServer.listen("0" as unknown as number);
    const addr = viteServer.httpServer!.address() as net.AddressInfo;
    host = addr.family === "IPv6" ? addr.address : "127.0.0.1";
    port = addr.port;

    // Warm up the Nitro dev environment (the worker initializes lazily on the
    // first request) so the WebSocket handshake isn't racing a cold start.
    const fetchHost = host.includes(":") ? `[${host}]` : host;
    await fetch(`http://${fetchHost}:${port}/socket`).catch(() => {});
  }, 60_000);

  afterAll(async () => {
    await viteServer?.close();
    if (rootDir) {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  // The bug: a `vite-hmr` upgrade on a non-HMR path was skipped by Nitro (and
  // ignored by Vite), so it hung in `pending`. It must now reach Nitro and get
  // a `101 Switching Protocols`.
  it("routes a `vite-hmr` upgrade on a non-HMR path to nitro", async () => {
    await expect(probeUpgrade(host, port, "/socket", "vite-hmr")).resolves.toContain("101");
  });

  it("routes a plain upgrade on a non-HMR path to nitro", async () => {
    await expect(probeUpgrade(host, port, "/socket")).resolves.toContain("101");
  });
});
