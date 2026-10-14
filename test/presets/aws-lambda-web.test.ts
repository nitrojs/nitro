import { execa } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { beforeAll, describe, expect, it } from "vitest";
import { setupTest } from "../tests.ts";

describe("nitro:preset:aws-lambda-web", async () => {
  const ctx = await setupTest("aws-lambda-web");

  beforeAll(async () => {
    const port = await getRandomPort();
    const server = execa(process.execPath, [resolve(ctx.outDir, "server/index.mjs")], {
      env: {
        AWS_LAMBDA_HTTP_ENDPOINT: `127.0.0.1:${port}`,
        NITRO_HOST: "127.0.0.2",
        NITRO_PORT: "1",
        NITRO_SSL_CERT: "missing-cert.pem",
        NITRO_SSL_KEY: "missing-key.pem",
      },
      stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
      reject: false,
    });
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: async () => {
        server.kill();
      },
    };
    await waitForPort(port, { host: "127.0.0.1", delay: 100, retries: 50 });
  }, 25_000);

  it("listens on the AWS HTTP endpoint instead of Nitro's host, port, and TLS settings", async () => {
    const response = await ctx.fetch("/");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("server entry works!");
  });

  it("serves routes and public assets from the deployment directory", async () => {
    const [route, asset] = await Promise.all([
      ctx.fetch("/api/hello"),
      ctx.fetch("/build/test.txt"),
    ]);
    expect(route.status).toBe(200);
    expect(await route.json()).toMatchObject({ message: "Hello API" });
    expect(asset.status).toBe(200);
    expect((await asset.text()).trim()).toBe("Works!");
  });
});
