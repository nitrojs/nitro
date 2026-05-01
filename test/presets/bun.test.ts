import { execa, execaCommandSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { describe } from "vitest";
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
});
