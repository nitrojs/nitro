import { execa, execaSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { describe, it, expect } from "vitest";
import { setupTest, testNitro } from "../tests.ts";
import { testCloseHook } from "./_close-hook.ts";

const hasBun = execaSync("bun", ["--version"], { stdio: "ignore", reject: false }).exitCode === 0;

describe.runIf(hasBun)("nitro:preset:bun", async () => {
  const ctx = await setupTest("bun");
  testNitro(
    ctx,
    async () => {
      const port = await getRandomPort();
      process.env.PORT = String(port);
      const p = execa("bun", [resolve(ctx.outDir, "server/index.mjs")], {
        stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
        reject: false,
      });
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
    },
    (ctx, callHandler) => {
      it("bun: ReadableStream polyfill works", async () => {
        const { data } = await callHandler({ url: "/bun-direct-stream" });
        expect(data.isStream).toBe(true);
        expect(data.hasCorrectPrototype).toBe(true);
      });
    }
  );

  testCloseHook(ctx, { command: "bun", args: (entry) => [entry] });
});
