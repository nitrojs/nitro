import { execa, execaCommandSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests";

const hasBun =
  execaCommandSync("bun --version", { stdio: "ignore", reject: false })
    .exitCode === 0;

describe.runIf(hasBun)("nitro:preset:bun", async () => {
  const ctx = await setupTest("bun");
  testNitro(
    ctx,
    async () => {
      const port = await getRandomPort();
      process.env.PORT = String(port);
      const p = execa("bun", [resolve(ctx.outDir, "server/index.mjs")], {
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
    },
    (_ctx, callHandler) => {
      // https://github.com/nitrojs/nitro/issues/4604
      it("exposes the request body via `event.node.req` stream", async () => {
        const { status, data } = await callHandler({
          url: "/api/node-req-body",
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "hello-from-bun",
        });
        expect(status).toBe(200);
        expect(data).toMatchObject({
          readableEnded: false,
          body: "hello-from-bun",
        });
      });
    }
  );
});
