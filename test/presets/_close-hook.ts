import { execa } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { isWindows } from "std-env";
import { expect, it } from "vitest";
import type { Context } from "../tests.ts";

const CLOSE_HOOK_MARKER = "[fixture] close hook called";

/**
 * Assert that the runtime `close` hooks run when a built server is terminated.
 *
 * srvx handles `SIGINT`/`SIGTERM` by calling `server.close()`, so this spawns the real
 * server output and signals it instead of calling `close()` in-process.
 */
export function testCloseHook(
  ctx: Context,
  opts: { command: string; args: (entry: string) => string[]; cwd?: string }
): void {
  it.skipIf(isWindows)(
    "calls `close` hooks on shutdown",
    async () => {
      const port = await getRandomPort();

      // srvx disables graceful shutdown (and therefore `server.close()`) when `CI` or
      // `TEST` are set, so the child runs without them to exercise the real signal path.
      const env: Record<string, string | undefined> = {
        ...process.env,
        NITRO_PORT: String(port),
        PORT: String(port),
        NITRO_HOST: "127.0.0.1",
        NITRO_TEST_CLOSE_HOOK: "true",
      };
      delete env.CI;
      delete env.TEST;

      const child = execa(opts.command, opts.args(resolve(ctx.outDir, "server/index.mjs")), {
        cwd: opts.cwd,
        env,
        extendEnv: false,
        reject: false,
      });

      let output = "";
      let exited = false;
      child.stdout!.on("data", (data) => (output += data));
      child.stderr!.on("data", (data) => (output += data));
      child.nodeChildProcess.once("close", () => (exited = true));

      try {
        await waitForPort(port, { delay: 1000, retries: 20, host: "127.0.0.1" });

        child.kill("SIGTERM");

        // The fixture schedule runner can keep the event loop alive after the server
        // closed, so wait for the marker (or the process to exit) instead of exit alone.
        const deadline = Date.now() + 10_000;
        while (!output.includes(CLOSE_HOOK_MARKER) && !exited && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 50));
        }

        expect(output).toContain(CLOSE_HOOK_MARKER);
        expect(output).not.toContain("unhandledRejection");
      } finally {
        // Not awaited: the fixture schedule runner can outlive the server, and a
        // dangling child is cleaned up by execa when the test process exits.
        child.kill("SIGKILL");
      }
    },
    40_000
  );
}
