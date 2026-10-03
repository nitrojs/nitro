import { createServer, request, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import type { Nitro } from "nitro/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NitroDevApp } from "../../src/dev/app.ts";

const sockets = new Set<Socket>();

function listen(server: Server): Promise<number> {
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
  });
}

/** Minimal upgrade-aware target: replies `101` then echoes raw frames. */
function createUpgradeTarget(upgrades: string[]): Server {
  const server = createServer((_req, res) => res.end("http"));
  server.on("upgrade", (req, socket) => {
    upgrades.push(req.url!);
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"
    );
    socket.on("data", (chunk) => socket.write(chunk));
  });
  return server;
}

function upgradeRequest(port: number, path: string) {
  return new Promise<{ status: number; echo: string }>((resolve, reject) => {
    const req = request({
      port,
      host: "127.0.0.1",
      path,
      headers: { Connection: "Upgrade", Upgrade: "websocket" },
    });
    const timeout = setTimeout(() => reject(new Error("upgrade timed out")), 5000);
    req.on("error", reject);
    req.on("response", (res) => {
      clearTimeout(timeout);
      reject(new Error(`unexpected HTTP response: ${res.statusCode}`));
    });
    req.on("upgrade", (res, socket) => {
      socket.once("data", (chunk) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ status: res.statusCode!, echo: chunk.toString() });
      });
      socket.write("ping");
    });
    req.end();
  });
}

describe("dev server devProxy websocket upgrades", () => {
  const upgrades: string[] = [];
  const target = createUpgradeTarget(upgrades);
  let devServer: Server;
  let devPort: number;
  let workerUpgrades = 0;

  beforeAll(async () => {
    const targetPort = await listen(target);
    const app = new NitroDevApp({
      logger: console,
      options: {
        baseURL: "/",
        devHandlers: [],
        publicAssets: [],
        devProxy: {
          "/proxy/ws": { target: `http://127.0.0.1:${targetPort}`, ws: true },
          "/proxy/http": { target: `http://127.0.0.1:${targetPort}` },
        },
      },
    } as unknown as Nitro);
    devServer = createServer(async (req, res) => {
      const response = await app.fetch(new Request(`http://127.0.0.1${req.url}`));
      res.end(await response.text());
    });
    devServer.on("upgrade", (req, socket, head) => {
      if (!app.proxyUpgrade(req, socket as Socket, head)) {
        workerUpgrades++;
        socket.destroy();
      }
    });
    devPort = await listen(devServer);
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await Promise.all([
      new Promise((resolve) => devServer.close(resolve)),
      new Promise((resolve) => target.close(resolve)),
    ]);
  });

  it("proxies upgrades for a matching rule with `ws` enabled", async () => {
    const res = await upgradeRequest(devPort, "/proxy/ws");
    expect(res.status).toBe(101);
    expect(res.echo).toBe("ping");
    expect(upgrades).toContain("/proxy/ws");
  });

  it("proxies upgrades for subpaths of a matching rule", async () => {
    const res = await upgradeRequest(devPort, "/proxy/ws/nested?foo=1");
    expect(res.status).toBe(101);
    expect(upgrades).toContain("/proxy/ws/nested?foo=1");
  });

  it("forwards upgrades to the worker when no rule enables `ws`", async () => {
    await expect(upgradeRequest(devPort, "/proxy/http")).rejects.toThrow();
    await expect(upgradeRequest(devPort, "/other")).rejects.toThrow();
    expect(workerUpgrades).toBe(2);
    expect(upgrades).not.toContain("/proxy/http");
  });
});
