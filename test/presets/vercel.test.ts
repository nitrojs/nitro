import { promises as fsp } from "node:fs";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest, startServer, testNitro } from "../tests";

describe("nitro:preset:vercel", async () => {
  const ctx = await setupTest("vercel");
  testNitro(
    ctx,
    async () => {
      const handle = await import(
        resolve(ctx.outDir, "functions/__nitro.func/index.mjs")
      ).then((r) => r.default || r);
      await startServer(ctx, handle);
      return async ({ url, ...options }) => {
        const res = await ctx.fetch(url, options);
        return res;
      };
    },
    () => {
      it("should add route rules to config", async () => {
        const config = await fsp
          .readFile(resolve(ctx.outDir, "config.json"), "utf8")
          .then((r) => JSON.parse(r));
        expect(config).toMatchInlineSnapshot(`
          {
            "overrides": {
              "_scalar/index.html": {
                "path": "_scalar",
              },
              "_swagger/index.html": {
                "path": "_swagger",
              },
              "api/hey/index.html": {
                "path": "api/hey",
              },
              "prerender/index.html": {
                "path": "prerender",
              },
            },
            "routes": [
              {
                "headers": {
                  "Location": "https://nitro.build/",
                },
                "src": "/rules/redirect/obj",
                "status": 308,
              },
              {
                "headers": {
                  "Location": "https://nitro.build/$1",
                },
                "src": "/rules/redirect/wildcard/(.*)",
                "status": 307,
              },
              {
                "headers": {
                  "Location": "/other",
                },
                "src": "/rules/nested/override",
                "status": 307,
              },
              {
                "headers": {
                  "cache-control": "s-maxage=60",
                },
                "src": "/rules/headers",
              },
              {
                "headers": {
                  "access-control-allow-headers": "*",
                  "access-control-allow-methods": "GET",
                  "access-control-allow-origin": "*",
                  "access-control-max-age": "0",
                },
                "src": "/rules/cors",
              },
              {
                "headers": {
                  "Location": "/base",
                },
                "src": "/rules/redirect",
                "status": 307,
              },
              {
                "headers": {
                  "Location": "/base",
                  "x-test": "test",
                },
                "src": "/rules/nested/(.*)",
                "status": 307,
              },
              {
                "headers": {
                  "cache-control": "public, max-age=3600, immutable",
                },
                "src": "/build/(.*)",
              },
              {
                "headers": {
                  "x-test": "test",
                },
                "src": "/(.*)",
              },
              {
                "continue": true,
                "headers": {
                  "cache-control": "public,max-age=31536000,immutable",
                },
                "src": "/build(.*)",
              },
              {
                "handle": "filesystem",
              },
              {
                "dest": "/rules/_/noncached/cached?url=$url",
                "src": "/rules/_/noncached/cached",
              },
              {
                "dest": "/__nitro",
                "src": "/rules/_/cached/noncached",
              },
              {
                "dest": "/__nitro",
                "src": "(?<url>/rules/_/noncached/.*)",
              },
              {
                "dest": "/__nitro--rules---cached?url=$url",
                "src": "(?<url>/rules/_/cached/.*)",
              },
              {
                "dest": "/__nitro",
                "src": "/rules/dynamic",
              },
              {
                "dest": "/__nitro--rules-isr?url=$url",
                "src": "(?<url>/rules/isr/.*)",
              },
              {
                "dest": "/__nitro--rules-isr-ttl?url=$url",
                "src": "(?<url>/rules/isr-ttl/.*)",
              },
              {
                "dest": "/__nitro--rules-swr?url=$url",
                "src": "(?<url>/rules/swr/.*)",
              },
              {
                "dest": "/__nitro--rules-swr-ttl?url=$url",
                "src": "(?<url>/rules/swr-ttl/.*)",
              },
              {
                "dest": "/__nitro",
                "src": "/(.*)",
              },
            ],
            "version": 3,
          }
        `);
      });

      it("should generate prerender config", async () => {
        const isrRouteConfig = await fsp.readFile(
          resolve(
            ctx.outDir,
            "functions/__nitro--rules-isr.prerender-config.json"
          ),
          "utf8"
        );
        expect(JSON.parse(isrRouteConfig)).toMatchObject({
          expiration: false,
          allowQuery: ["q", "url"],
        });
      });
    }
  );
});
