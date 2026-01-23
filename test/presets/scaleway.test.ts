import { describe } from "vitest";
import { resolve } from "pathe";
import { serveHandler } from "@scaleway/serverless-functions";
import { getRandomPort, waitForPort } from "get-port-please";
import { setupTest, testNitro } from "../tests.ts";

describe("nitro:preset:scaleway", async () => {
  const ctx = await setupTest("scaleway-serverless");

  testNitro(ctx, async () => {
    const { handler } = await import(resolve(ctx.outDir, "server/index.mjs"));
    const port = await getRandomPort();
    const server = serveHandler(handler, port);

    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: () => server.close(),
    };

    await waitForPort(port, { host: "127.0.0.1" });

    return async ({ url, ...options }) => {
      const response = await ctx.fetch(url, options);
      return response;
    };
  });
});
