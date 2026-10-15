import { createServer, request, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { createHooks } from "hookable";
import type { Nitro, NitroDevServer } from "nitropack/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDevServer } from "../../src/core/dev-server/server";

const sockets = new Set<Socket>();

function listen(server: Server): Promise<number> {
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () =>
      resolve((server.address() as AddressInfo).port)
    );
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
    const timeout = setTimeout(
      () => reject(new Error("upgrade timed out")),
      5000
    );
    req.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
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
  let nitroDevServer: NitroDevServer;
  let server: Server;
  let port: number;
  let workerUpgrades = 0;

  beforeAll(async () => {
    const targetPort = await listen(target);
    const nitro = {
      hooks: createHooks(),
      options: {
        output: { dir: "/tmp/nitro-dev-proxy-ws", serverDir: "server" },
        buildDir: "/tmp/nitro-dev-proxy-ws/.nitro",
        devServer: { watch: [] },
        devHandlers: [],
        publicAssets: [],
        routeRules: {},
        runtimeConfig: { app: { baseURL: "/" } },
        devProxy: {
          "/proxy/ws": { target: `http://127.0.0.1:${targetPort}`, ws: true },
          "/proxy/target/": {
            target: `http://127.0.0.1:${targetPort}/base`,
            ws: true,
          },
          "/proxy/http": { target: `http://127.0.0.1:${targetPort}` },
        },
      },
    } as unknown as Nitro;
    nitroDevServer = createDevServer(nitro);
    // No worker will ever be available, so upgrades that reach it fail fast
    await nitro.hooks.callHook("dev:error", new Error("no worker"));

    server = createServer((_req, res) => res.end("dev"));
    server.on("upgrade", (req, socket, head) => {
      // Upgrades that reach the worker reject with "No worker available."
      Promise.resolve(
        nitroDevServer.upgrade(req, socket as Socket, head)
      ).catch(() => {
        workerUpgrades++;
        socket.destroy();
      });
    });
    port = await listen(server);
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await nitroDevServer.close();
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => target.close(resolve)),
    ]);
  });

  it("proxies upgrades for a matching rule with `ws` enabled", async () => {
    const res = await upgradeRequest(port, "/proxy/ws");
    expect(res.status).toBe(101);
    expect(res.echo).toBe("ping");
    expect(upgrades).toContain("/");
  });

  it("strips the route prefix like HTTP proxying", async () => {
    const res = await upgradeRequest(port, "/proxy/ws/nested?foo=1");
    expect(res.status).toBe(101);
    expect(upgrades).toContain("/nested?foo=1");

    await upgradeRequest(port, "/proxy/target/socket");
    expect(upgrades).toContain("/base/socket");
  });

  it("falls through to the worker when no `ws` rule matches", async () => {
    upgrades.length = 0;
    workerUpgrades = 0;
    await expect(upgradeRequest(port, "/proxy/http")).rejects.toThrow();
    await expect(upgradeRequest(port, "/other")).rejects.toThrow();
    expect(workerUpgrades).toBe(2);
    expect(upgrades).toEqual([]);
  });
});
