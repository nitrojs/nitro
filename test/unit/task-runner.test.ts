import http from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import { listTasks, runTask } from "../../src/task.ts";

describe("task runner devFetch", () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterAll(async () => {
    for (const cleanup of cleanups) {
      await cleanup();
    }
  });

  // A worker socket that accepts connections but never responds, like a
  // stalled dev server whose pid is still alive.
  async function stalledDevServer() {
    const cwd = await mkdtemp(join(tmpdir(), "nitro-task-test-"));
    cleanups.push(() => rm(cwd, { recursive: true, force: true }));

    const socketPath = join(cwd, "worker.sock");
    const server = http.createServer(() => {});
    cleanups.push(() => new Promise((resolve) => server.close(() => resolve())));
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));

    const buildDir = join(cwd, "node_modules/.nitro");
    await mkdir(buildDir, { recursive: true });
    await writeFile(
      join(buildDir, "nitro.dev.json"),
      JSON.stringify({
        dev: { pid: process.pid, workerAddress: { socketPath } },
      })
    );

    return cwd;
  }

  // https://github.com/unjs/nitro/issues/4292
  it("rejects instead of hanging when the dev server socket stalls", async () => {
    const cwd = await stalledDevServer();
    await expect(listTasks({ cwd, timeout: 200 })).rejects.toThrow(/timed out/i);
  }, 5000);

  it("honours an opt-in timeout for runTask", async () => {
    const cwd = await stalledDevServer();
    await expect(runTask({ name: "db:migrate" }, { cwd, timeout: 200 })).rejects.toThrow(
      /timed out/i
    );
  }, 5000);

  // The socket stays idle for as long as the task runs, so only listTasks may
  // carry a default. Read the request options rather than waiting 30s for it.
  it("defaults the timeout for listTasks but not for runTask", async () => {
    const cwd = await stalledDevServer();
    const request = vi.spyOn(http, "request");

    const requested = async (call: Promise<unknown>) => {
      call.catch(() => {});
      await vi.waitFor(() => expect(request).toHaveBeenCalled());
      const [, options] = request.mock.calls[0] as [unknown, { timeout?: number }];
      (request.mock.results[0].value as http.ClientRequest).destroy();
      request.mockClear();
      return options;
    };

    expect(await requested(listTasks({ cwd }))).toHaveProperty("timeout", 30_000);
    expect(await requested(runTask({ name: "db:migrate" }, { cwd }))).not.toHaveProperty("timeout");
    expect(await requested(runTask({ name: "db:migrate" }, { cwd, timeout: 200 }))).toHaveProperty(
      "timeout",
      200
    );

    request.mockRestore();
  }, 5000);
});
