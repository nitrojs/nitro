import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execa } from "execa";
import { getRandomPort } from "get-port-please";
import { resolve } from "pathe";
import { isBun, isWindows } from "std-env";
import { describe, expect, it } from "vitest";
import { setupTest, startServer, testNitro } from "../tests.ts";
import { testCloseHook } from "./_close-hook.ts";
import { testListenError } from "./_listen-error.ts";
import { testUnixSocket } from "./_unix-socket.ts";
import { waitForServer } from "./_wait-for-server.ts";

// Tests spawning the output are skipped on Bun: under `bun --bun`, `node` resolves to Bun,
// where the crossws Node.js adapter refuses to run (the `bun` preset is the native path)

const presetFixturesDir = resolve(import.meta.dirname, "fixtures");

describe("nitro:preset:node-middleware", async () => {
  const ctx = await setupTest("node-middleware");

  testNitro(ctx, async () => {
    const entryPath = resolve(ctx.outDir, "server/index.mjs");
    const { middleware } = await import(entryPath);

    await startServer(ctx, middleware);

    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });

  it("should handle nested cached route rules", async () => {
    const cached = await ctx.fetch("/rules/_/noncached/cached");
    expect(cached.headers.get("etag")).toBeDefined();

    const noncached = await ctx.fetch("/rules/_/noncached/noncached");
    expect(noncached.headers.get("etag")).toBeNull();

    const cached2 = await ctx.fetch("/rules/_/cached/cached");
    expect(cached2.headers.get("etag")).toBeDefined();

    const noncached2 = await ctx.fetch("/rules/_/cached/noncached");
    expect(noncached2.headers.get("etag")).toBeNull();
  });

  it("should trace externals", () => {
    const serverNodeModules = resolve(ctx.outDir, "server/node_modules");
    expect(existsSync(resolve(serverNodeModules, "@fixture/nitro-utils/extra.mjs"))).toBe(true);
    // required from a bundled CommonJS package (https://github.com/nitrojs/nitro/issues/4093)
    expect(existsSync(resolve(serverNodeModules, "@fixture/nitro-native-mock/index.js"))).toBe(
      true
    );
  });

  it("writes the entry chunk as server entry of the build info", async () => {
    const buildInfo = JSON.parse(await readFile(resolve(ctx.outDir, "nitro.json"), "utf8"));
    expect(buildInfo.serverEntry).toBe("server/index.mjs");
  });

  // Bun names chunks itself (`_chunks/[name]-[hash].mjs`)
  it.skipIf(process.env.NITRO_BUILDER === "bun")("names chunks by their modules", () => {
    const serverDir = resolve(ctx.outDir, "server");
    for (const file of [
      "_routes/api/echo.mjs",
      "_tasks/test.mjs",
      "_libs/unstorage.mjs",
      "_wasm/sum.mjs",
    ]) {
      expect(existsSync(resolve(serverDir, file)), file).toBe(true);
    }
  });
});

describe("nitro:preset:node-server", async () => {
  const ctx = await setupTest("node-server", {
    config: {
      features: { websocket: true },
      handlers: [
        { route: "/_ws", handler: resolve(presetFixturesDir, "websocket.ts") },
        { route: "/_ws-protocol", handler: resolve(presetFixturesDir, "websocket-protocol.ts") },
      ],
    },
  });

  it("passes server entry options to srvx", async ({ skip }) => {
    skip(isBun);
    const port = await getRandomPort();
    const child = execa(process.execPath, [resolve(ctx.outDir, "server/index.mjs")], {
      env: { NITRO_PORT: String(port), NITRO_HOST: "127.0.0.1" },
      stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
      reject: false,
    });
    try {
      await waitForServer(`http://127.0.0.1:${port}/`, child.nodeChildProcess);
      const res = await fetch(`http://127.0.0.1:${port}/srvx-middleware`);
      expect(await res.text()).not.toBe("server entry middleware works!");
      expect(res.headers.get("x-srvx-plugin")).toBeNull();
      const large = await fetch(`http://127.0.0.1:${port}/api/body-size`, {
        method: "POST",
        body: "x".repeat(128 * 1024),
      });
      expect(large.status).toBe(413);
    } finally {
      child.kill("SIGKILL");
    }
  }, 40_000);

  // #3925: browsers fail the handshake unless the server accepts one of the offered subprotocols
  it.skipIf(isBun || typeof WebSocket !== "function")(
    "negotiates WebSocket subprotocols",
    async () => {
      const port = await getRandomPort();
      const child = execa(process.execPath, [resolve(ctx.outDir, "server/index.mjs")], {
        env: { NITRO_PORT: String(port), NITRO_HOST: "127.0.0.1" },
        stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
        reject: false,
      });
      try {
        await waitForServer(`http://127.0.0.1:${port}/`, child.nodeChildProcess);
        await expect(
          negotiateProtocol(`ws://127.0.0.1:${port}/_ws-protocol`, ["graphql-transport-ws"])
        ).resolves.toBe("graphql-transport-ws");
        // No subprotocol is accepted unless a handler opts in
        await expect(
          negotiateProtocol(`ws://127.0.0.1:${port}/_ws`, ["graphql-transport-ws"])
        ).rejects.toThrow("WebSocket handshake failed");
      } finally {
        child.kill("SIGKILL");
      }
    },
    40_000
  );

  // `node .output/server/index.mjs task ...` runs tasks without starting the server
  describe.skipIf(isBun)("task cli", () => {
    const runTaskCLI = (args: string[]) =>
      execa(process.execPath, [resolve(ctx.outDir, "server/index.mjs"), "task", ...args], {
        env: { NITRO_TEST_CLOSE_HOOK: "true" },
        reject: false,
        timeout: 20_000,
      });

    it("lists tasks", async () => {
      const { exitCode, stdout } = await runTaskCLI(["list"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("`db:migrate` - Run database migrations");
      expect(stdout).toContain("`test` - task to debug");
    });

    it("runs a task, calls `close` hooks and exits", async () => {
      const { exitCode, stdout } = await runTaskCLI(["run", "test", "--payload", '{"foo":"bar"}']);
      expect(exitCode).toBe(0);
      const lines = stdout.trim().split("\n");
      expect(lines).toContain("[fixture] close hook called");
      // The result is the last line of stdout
      expect(JSON.parse(lines.at(-1)!)).toMatchObject({
        result: { name: "test", payload: { foo: "bar" } },
      });
    });

    it("exits non-zero when the task throws", async () => {
      const { exitCode, stderr } = await runTaskCLI(["run", "test", "--payload", '{"error":1}']);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("test error");
    });

    it("exits non-zero on unknown tasks and invalid arguments", async () => {
      for (const args of [
        ["run", "unknown"],
        ["run", "test", "--payload", "[]"],
        ["run", "test", "--unknown-flag"],
        ["run"],
        ["unknown"],
      ]) {
        const { exitCode } = await runTaskCLI(args);
        expect(exitCode, args.join(" ")).toBe(1);
      }
    });
  });

  if (!isBun) {
    testCloseHook(ctx, { command: process.execPath, args: (entry) => [entry] });
    testUnixSocket(ctx, { command: process.execPath, args: (entry) => [entry] });
    testListenError(ctx, { command: process.execPath, args: (entry) => [entry] });
  }
});

describe("nitro:preset:node-cluster", async () => {
  const ctx = await setupTest("node-cluster");

  // Signals sent to the primary (`index.mjs`) must be forwarded to workers, and the
  // primary must exit once every worker has shut down.
  testCloseHook(ctx, {
    command: process.execPath,
    args: (entry) => [entry],
    env: { NITRO_CLUSTER_WORKERS: "2" },
    exitCode: 0,
  });

  it.skipIf(isWindows || isBun)(
    "exits non-zero when all workers exit unexpectedly",
    async () => {
      const port = await getRandomPort();
      const child = execa(process.execPath, [resolve(ctx.outDir, "server/index.mjs")], {
        env: {
          NITRO_CLUSTER_WORKERS: "1",
          NITRO_PORT: String(port),
          NITRO_HOST: "127.0.0.1",
        },
        extendEnv: false,
        reject: false,
      });

      try {
        await waitForServer(`http://127.0.0.1:${port}/`, child.nodeChildProcess);

        // SIGKILL the sole worker (child of the primary) like a crash would.
        const { stdout: workerPids } = await execa("pgrep", [
          "-P",
          String(child.nodeChildProcess.pid),
        ]);
        process.kill(Number.parseInt(workerPids.trim()), "SIGKILL");

        const { exitCode } = await child;
        expect(exitCode).toBe(1);
      } finally {
        child.kill("SIGKILL");
      }
    },
    40_000
  );

  testUnixSocket(ctx, {
    command: process.execPath,
    args: (entry) => [entry],
    env: { NITRO_CLUSTER_WORKERS: "2" },
  });

  testListenError(ctx, {
    command: process.execPath,
    args: (entry) => [entry],
    env: { NITRO_CLUSTER_WORKERS: "2" },
    skip: isBun,
  });
});

// Opens a connection offering `protocols` and resolves with the subprotocol the server accepted.
function negotiateProtocol(url: string, protocols: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, protocols);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Timed out waiting for the WebSocket handshake"));
    }, 5000);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(ws.protocol);
      ws.close();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket handshake failed"));
    });
  });
}
