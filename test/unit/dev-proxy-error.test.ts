import { createServer, get, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { toNodeListener } from "h3";
import { createHooks } from "hookable";
import type { Nitro, NitroDevServer } from "nitropack/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDevServer } from "../../src/core/dev-server/server";

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () =>
      resolve((server.address() as AddressInfo).port)
    );
  });
}

function fetchStatus(port: number, path: string) {
  return new Promise<{ status: number; refresh?: string }>(
    (resolve, reject) => {
      const req = get({ port, host: "127.0.0.1", path }, (res) => {
        res.resume();
        res.on("end", () =>
          resolve({
            status: res.statusCode!,
            refresh: res.headers.refresh as string | undefined,
          })
        );
      });
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error("no response"));
      });
      req.on("error", reject);
    }
  );
}

describe("dev server devProxy errors", () => {
  const target = createServer((_req, res) => res.end("ok"));
  let nitroDevServer: NitroDevServer;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const targetPort = await listen(target);
    // Grab a free port, then close it so connections are refused
    const closed = createServer();
    const refusedPort = await listen(closed);
    await new Promise((resolve) => closed.close(resolve));

    const nitro = {
      hooks: createHooks(),
      options: {
        output: { dir: "/tmp/nitro-dev-proxy-error", serverDir: "server" },
        buildDir: "/tmp/nitro-dev-proxy-error/.nitro",
        devServer: { watch: [] },
        devHandlers: [],
        publicAssets: [],
        routeRules: {},
        runtimeConfig: { app: { baseURL: "/" } },
        devProxy: {
          "/proxy/ok": { target: `http://127.0.0.1:${targetPort}` },
          "/proxy/refused": { target: `http://127.0.0.1:${refusedPort}` },
        },
      },
    } as unknown as Nitro;
    nitroDevServer = createDevServer(nitro);
    server = createServer(toNodeListener(nitroDevServer.app));
    port = await listen(server);
  });

  afterAll(async () => {
    await nitroDevServer.close();
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => target.close(resolve)),
    ]);
  });

  it("proxies requests to a reachable target", async () => {
    const res = await fetchStatus(port, "/proxy/ok");
    expect(res.status).toBe(200);
  });

  it("responds with 503 when the proxy target is unreachable", async () => {
    const res = await fetchStatus(port, "/proxy/refused");
    expect(res.status).toBe(503);
    expect(res.refresh).toBe("3");
  });
});
