import { createServer } from "node:net";
import { execa } from "execa";
import { resolve } from "pathe";
import { expect, it } from "vitest";
import type { Context } from "../tests.ts";

/**
 * Assert that a built server exits non-zero when it cannot listen (`EADDRINUSE`).
 *
 * The child runs without `TEST` so the fixture `scheduledTasks` runner starts and keeps the
 * event loop alive, like it would in production (without it, Node.js would exit on its own).
 */
export function testListenError(
  ctx: Context,
  opts: {
    command: string;
    args: (entry: string) => string[];
    env?: Record<string, string>;
    skip?: boolean;
  }
): void {
  it.skipIf(opts.skip)(
    "exits non-zero when the port is already in use",
    async () => {
      const blocker = createServer();
      await new Promise<void>((r) => blocker.listen(0, "127.0.0.1", r));
      const { port } = blocker.address() as { port: number };

      const env: Record<string, string | undefined> = {
        ...process.env,
        ...opts.env,
        NITRO_PORT: String(port),
        NITRO_HOST: "127.0.0.1",
      };
      delete env.CI;
      delete env.TEST;

      const child = execa(opts.command, opts.args(resolve(ctx.outDir, "server/index.mjs")), {
        env,
        extendEnv: false,
        reject: false,
        timeout: 10_000,
        all: true,
      });

      try {
        const result = await child;
        expect(result.timedOut, result.all).toBe(false);
        expect(result.exitCode).toBe(1);
        expect(result.all).toContain("EADDRINUSE");
      } finally {
        child.kill("SIGKILL");
        await new Promise((r) => blocker.close(r));
      }
    },
    20_000
  );
}
