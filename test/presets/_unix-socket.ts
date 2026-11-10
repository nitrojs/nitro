import { mkdtemp, rm } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { execa } from "execa";
import { getRandomPort } from "get-port-please";
import { join, resolve } from "pathe";
import { isWindows } from "std-env";
import { expect, it } from "vitest";
import type { Context } from "../tests.ts";

/**
 * Assert that a built server listens on `NITRO_UNIX_SOCKET` instead of a TCP port.
 */
export function testUnixSocket(
  ctx: Context,
  opts: { command: string; args: (entry: string) => string[]; env?: Record<string, string> }
): void {
  it.skipIf(isWindows)(
    "listens on NITRO_UNIX_SOCKET",
    async () => {
      // Socket paths are limited to ~108 chars, so use a short temp dir
      const dir = await mkdtemp(join(tmpdir(), "nitro-sock-"));
      const socketPath = join(dir, "nitro.sock");
      const child = execa(opts.command, opts.args(resolve(ctx.outDir, "server/index.mjs")), {
        env: {
          ...opts.env,
          NITRO_UNIX_SOCKET: socketPath,
          NITRO_PORT: String(await getRandomPort()),
        },
        stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
        reject: false,
      });
      try {
        const res = await fetchSocket(socketPath, "/api/hello");
        expect(res.status).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ message: "Hello API" });
      } finally {
        child.kill("SIGKILL");
        await rm(dir, { recursive: true, force: true });
      }
    },
    20_000
  );
}

async function fetchSocket(
  socketPath: string,
  path: string
): Promise<{ status: number; body: string }> {
  const deadline = Date.now() + 15_000;
  while (true) {
    try {
      return await new Promise((resolve, reject) => {
        const req = request({ socketPath, path }, (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve({ status: res.statusCode!, body }));
          res.on("error", reject);
        });
        req.on("error", reject);
        req.end();
      });
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
