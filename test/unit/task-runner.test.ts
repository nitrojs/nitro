import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listTasks, runTask } from "../../src/core/task";

describe("task runner (dev worker on socket)", () => {
  let cwd: string;
  let server: Server;
  const socketPath =
    process.platform === "win32"
      ? String.raw`\\.\pipe\nitro-task-test-${process.pid}-${Date.now()}`
      : join(tmpdir(), `nitro-task-test-${process.pid}-${Date.now()}.sock`);

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        if (req.method === "GET" && req.url === "/_nitro/tasks") {
          res.end(
            JSON.stringify({ tasks: { "db:migrate": { description: "x" } } })
          );
          return;
        }
        if (req.url === "/_nitro/tasks/fail") {
          res.statusCode = 500;
          res.end(JSON.stringify({ message: "boom" }));
          return;
        }
        res.end(
          JSON.stringify({
            result: {
              method: req.method,
              url: req.url,
              body: JSON.parse(body),
            },
          })
        );
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, resolve);
    });

    cwd = await mkdtemp(join(tmpdir(), "nitro-task-"));
    await mkdir(join(cwd, ".nitro"));
    await writeFile(
      join(cwd, ".nitro/nitro.json"),
      JSON.stringify({
        dev: { pid: process.pid, workerAddress: { socketPath } },
      })
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => server?.close(resolve));
    if (cwd) {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("listTasks", async () => {
    expect(await listTasks({ cwd })).toEqual({
      "db:migrate": { description: "x" },
    });
  });

  it("runTask", async () => {
    const res = await runTask(
      { name: "db:migrate", context: {}, payload: { foo: "bar" } },
      { cwd }
    );
    expect(res).toMatchObject({
      result: {
        method: "POST",
        url: "/_nitro/tasks/db:migrate",
        body: { name: "db:migrate", payload: { foo: "bar" } },
      },
    });
  });

  it("runTask rejects on error status", async () => {
    await expect(
      runTask({ name: "fail", context: {}, payload: {} }, { cwd })
    ).rejects.toMatchObject({ statusCode: 500, data: { message: "boom" } });
  });
});
