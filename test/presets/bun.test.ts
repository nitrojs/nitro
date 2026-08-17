import { execa, execaCommandSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

const hasBun = execaCommandSync("bun --version", { stdio: "ignore", reject: false }).exitCode === 0;

describe.runIf(hasBun)("nitro:preset:bun", async () => {
  const ctx = await setupTest("bun");
  testNitro(ctx, async () => {
    const port = await getRandomPort();
    process.env.PORT = String(port);
    process.env.NITRO_BUN_IDLE_TIMEOUT = "1";
    const p = execa(
      "bun",
      [
        "--preload",
        resolve(import.meta.dirname, "fixtures/bun-preload.ts"),
        resolve(ctx.outDir, "server/index.mjs"),
      ],
      { stdio: "inherit", reject: false }
    );
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: async () => {
        p.kill();
        await p;
      },
    } as any;
    await waitForPort(port);
    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });

  it("forwards the idle timeout to Bun", async () => {
    const response = await fetch(`${ctx.server!.url}/_bun/idle-timeout`);
    expect(await response.text()).toBe("1");
  });
});
