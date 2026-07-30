import { fileURLToPath } from "node:url";
import { dirname, resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { createServer, type InlineConfig, type ViteDevServer } from "vite";

import { nitro } from "../../src/build/vite/plugin.ts";
import type { FetchableDevEnvironment } from "../../src/build/vite/dev.ts";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "../fixture");

// A single `nitro()` plugin instance shared by several Vite dev servers created in the same
// process (as vitest does when initialising projects with `Promise.allSettled`).
function sharedConfig(plugins: ReturnType<typeof nitro>): InlineConfig {
  return {
    root: fixtureDir,
    configFile: false,
    logLevel: "silent",
    plugins: [plugins],
    server: { middlewareMode: true, hmr: false },
  };
}

// `Promise.all` rejects before the callers' `finally`, so any server that did start must be
// closed here or it keeps the runner worker (and the vitest process) alive.
async function createServers(plugins: ReturnType<typeof nitro>, count: number) {
  const servers: ViteDevServer[] = [];
  try {
    await Promise.all(
      Array.from({ length: count }, async () => {
        servers.push(await createServer(sharedConfig(plugins)));
      })
    );
  } catch (error) {
    await Promise.all(servers.map((server) => server.close()));
    throw error;
  }
  return servers;
}

async function hello(server: ViteDevServer) {
  const env = server.environments.nitro as FetchableDevEnvironment;
  const res = await env.dispatchFetch(new Request("http://localhost/api/hello"));
  return { status: res.status, body: await res.text() };
}

describe("vite dev servers sharing a plugin instance", () => {
  it("should create concurrently without racing env runner init", async () => {
    const plugins = nitro();
    const servers = await createServers(plugins, 2);
    try {
      for (const server of servers) {
        expect(await hello(server)).toMatchObject({
          status: 200,
          body: expect.stringContaining("Hello"),
        });
      }
    } finally {
      await Promise.all(servers.map((server) => server.close()));
    }
  });

  it("should keep the env runner alive until the last server closes", async () => {
    const plugins = nitro();
    const [first, second] = await createServers(plugins, 2);
    try {
      await first.close();
      expect(await hello(second)).toMatchObject({ status: 200 });
    } finally {
      await second.close();
    }
  });
});
