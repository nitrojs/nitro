import { execa, execaSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests.ts";
import { testCloseHook } from "./_close-hook.ts";

const hasBun = execaSync("bun", ["--version"], { stdio: "ignore", reject: false }).exitCode === 0;

// Not Bun's default (10s), so the assertion cannot pass by accident, and high
// enough to not drop idle keep-alive connections between test requests.
const idleTimeout = "42";

describe.runIf(hasBun)("nitro:preset:bun", async () => {
  const ctx = await setupTest("bun");
  testNitro(ctx, async () => {
    const port = await getRandomPort();
    process.env.PORT = String(port);
    const p = execa(
      "bun",
      [
        "--preload",
        resolve(import.meta.dirname, "fixtures/bun-preload.ts"),
        resolve(ctx.outDir, "server/index.mjs"),
      ],
      {
        stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
        reject: false,
        env: { NITRO_BUN_IDLE_TIMEOUT: idleTimeout },
      }
    );
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: async () => {
        p.kill();
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
    expect(await response.text()).toBe(idleTimeout);
  });

  testCloseHook(ctx, { command: "bun", args: (entry) => [entry] });
});
