import { execa, execaCommandSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { describe } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

const hasDeno =
  execaCommandSync("deno --version", { stdio: "ignore", reject: false }).exitCode === 0;

describe.runIf(hasDeno)("nitro:preset:deno-server", async () => {
  const ctx = await setupTest("deno-server");
  testNitro(ctx, async () => {
    const port = await getRandomPort();
    execa("deno", ["task", "start"], {
      cwd: ctx.outDir,
      // stdio: "inherit",
      stdio: "ignore",
      env: {
        NITRO_PORT: String(port),
        NITRO_HOST: "127.0.0.1",
      },
    });
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: () => {
        // p.kill()
      },
    } as any;
    await waitForPort(port, { delay: 1000, retries: 20, host: "127.0.0.1" });
    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });
});
