import http from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { listTasks } from "../../src/task.ts";

describe("task runner devFetch", () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterAll(async () => {
    for (const cleanup of cleanups) {
      await cleanup();
    }
  });

  // https://github.com/unjs/nitro/issues/4292
  it("rejects instead of hanging when the dev server socket stalls", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "nitro-task-test-"));
    cleanups.push(() => rm(cwd, { recursive: true, force: true }));

    // A worker socket that accepts connections but never responds, like a
    // stalled dev server whose pid is still alive.
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

    await expect(listTasks({ cwd, timeout: 200 })).rejects.toThrow(/timed out/i);
  }, 5000);
});
