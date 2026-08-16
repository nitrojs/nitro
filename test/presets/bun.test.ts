import { execa, execaCommandSync } from "execa";
import { isWindows } from "std-env";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { describe, it, expect } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

const hasBun = execaCommandSync("bun --version", { stdio: "ignore", reject: false }).exitCode === 0;

describe.runIf(hasBun)("nitro:preset:bun", async () => {
  const ctx = await setupTest("bun");
  testNitro(ctx, async () => {
    const port = await getRandomPort();
    process.env.PORT = String(port);
    execa("bun", [resolve(ctx.outDir, "server/index.mjs")], {
      stdio: "inherit",
    });
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: () => {
        // p.kill()
      },
    } as any;
    await waitForPort(port);
    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });
  it.skipIf(isWindows)(
    "calls the `close` hook on shutdown",
    async () => {
      const port = await getRandomPort();
      const entryPath = resolve(ctx.outDir, "server/index.mjs");
      // srvx graceful shutdown is disabled when the CI/TEST env vars are set,
      // so drop them for this child to exercise the real SIGTERM path.
      const env: Record<string, string | undefined> = {
        ...process.env,
        PORT: String(port),
        NITRO_HOST: "127.0.0.1",
        NITRO_TEST_CLOSE_HOOK: "true",
      };
      delete env.CI;
      delete env.TEST;
      const child = execa("bun", [entryPath], {
        env,
        extendEnv: false,
        reject: false,
      });

      let output = "";
      child.stdout!.on("data", (data) => (output += data));
      child.stderr!.on("data", (data) => (output += data));

      await waitForPort(port, { delay: 1000, retries: 20, host: "127.0.0.1" });

      child.kill("SIGTERM");
      await new Promise<void>((r) => {
        const timeout = setTimeout(r, 10_000);
        child.on("close", () => {
          clearTimeout(timeout);
          r();
        });
        child.stdout!.on("data", (data) => {
          if (String(data).includes("[fixture] close hook called")) {
            clearTimeout(timeout);
            r();
          }
        });
      });
      child.kill("SIGKILL");

      expect(output).toContain("[fixture] close hook called");
      expect(output).not.toContain("unhandledRejection");
    },
    40_000
  );
});
