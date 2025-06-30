import { existsSync, promises as fsp } from "node:fs";
import { execa } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests";

describe("nitro:preset:azure", { timeout: 10_000 }, async () => {
  const customConfig = {
    routes: [
      {
        route: "/admin",
        allowedRoles: ["authenticated"],
      },
      {
        route: "/logout",
        redirect: "/.auth/logout",
      },
      {
        route: "/index.html",
        redirect: "/overridden-index",
      },
      {
        route: "/",
        rewrite: "/api/server/overridden",
      },
    ],
    responseOverrides: {
      401: {
        statusCode: 302,
        redirect: "/.auth/login/aad",
      },
    },
    networking: {
      allowedIpRanges: ["10.0.0.0/24", "100.0.0.0/32", "192.168.100.0/22"],
    },
    platform: {
      apiRuntime: "custom-runtime",
    },
  };

  const ctx = await setupTest("azure", {
    config: {
      azure: {
        config: customConfig,
      },
    },
  });

  if (process.env.TEST_AZURE) {
    testNitro(ctx, async () => {
      const port = await getRandomPort();
      const apiPort = await getRandomPort(); // Avoids conflicts with other tests
      await new Promise((resolve) => setTimeout(resolve, 500)); // Make sure output is written to disk
      expect(existsSync(ctx.outDir));
      const p = execa(
        "swa",
        `start .output/public --api-location .output/server --host 127.0.0.1 --port ${port} --api-port ${apiPort}`.split(
          " "
        ),
        {
          cwd: resolve(ctx.outDir, ".."),
          stdio: "inherit",
          // stderr: "inherit",
          // stdout: "ignore",
        }
      );
      ctx.server = {
        url: `http://127.0.0.1:${port}`,
        close: () => p.kill(),
      } as any;
      await waitForPort(port, { host: "127.0.0.1", retries: 20 });
      return async ({ url, ...opts }) => {
        const res = await ctx.fetch(url, opts);
        return res;
      };
    });
  }

  const config = await fsp
    .readFile(resolve(ctx.rootDir, "staticwebapp.config.json"), "utf8")
    .then((r) => JSON.parse(r));

  it("generated the correct config", () => {
    expect(config).toMatchInlineSnapshot(`
        {
          "navigationFallback": {
            "rewrite": "/api/server",
          },
          "networking": {
            "allowedIpRanges": [
              "10.0.0.0/24",
              "100.0.0.0/32",
              "192.168.100.0/22",
            ],
          },
          "platform": {
            "apiRuntime": "custom-runtime",
          },
          "responseOverrides": {
            "401": {
              "redirect": "/.auth/login/aad",
              "statusCode": 302,
            },
          },
          "routes": [
            {
              "allowedRoles": [
                "authenticated",
              ],
              "route": "/admin",
            },
            {
              "redirect": "/.auth/logout",
              "route": "/logout",
            },
            {
              "rewrite": "/prerender-custom.html",
              "route": "/prerender-custom",
            },
            {
              "rewrite": "/api/hey/index.html",
              "route": "/api/hey",
            },
            {
              "rewrite": "/_swagger/index.html",
              "route": "/_swagger",
            },
            {
              "rewrite": "/_scalar/index.html",
              "route": "/_scalar",
            },
            {
              "rewrite": "/prerender/index.html",
              "route": "/prerender",
            },
            {
              "redirect": "/overridden-index",
              "route": "/index.html",
            },
            {
              "rewrite": "/api/server/overridden",
              "route": "/",
            },
          ],
        }
      `);
  });
});
