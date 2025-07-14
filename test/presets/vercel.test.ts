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
                "dest": "/wasm/static-import",
                "src": "/wasm/static-import",
              },
              {
                "dest": "/wasm/dynamic-import",
                "src": "/wasm/dynamic-import",
              },
              {
                "dest": "/wait-until",
                "src": "/wait-until",
              },
              {
                "dest": "/stream",
                "src": "/stream",
              },
              {
                "dest": "/static-flags",
                "src": "/static-flags",
              },
              {
                "dest": "/route-group",
                "src": "/route-group",
              },
              {
                "dest": "/raw",
                "src": "/raw",
              },
              {
                "dest": "/prerender-custom.html",
                "src": "/prerender-custom.html",
              },
              {
                "dest": "/prerender",
                "src": "/prerender",
              },
              {
                "dest": "/node-compat",
                "src": "/node-compat",
              },
              {
                "dest": "/modules",
                "src": "/modules",
              },
              {
                "dest": "/jsx",
                "src": "/jsx",
              },
              {
                "dest": "/json-string",
                "src": "/json-string",
              },
              {
                "dest": "/imports",
                "src": "/imports",
              },
              {
                "dest": "/icon.png",
                "src": "/icon.png",
              },
              {
                "dest": "/file",
                "src": "/file",
              },
              {
                "dest": "/fetch",
                "src": "/fetch",
              },
              {
                "dest": "/error-stack",
                "src": "/error-stack",
              },
              {
                "dest": "/env",
                "src": "/env",
              },
              {
                "dest": "/context",
                "src": "/context",
              },
              {
                "dest": "/config",
                "src": "/config",
              },
              {
                "dest": "/assets/md",
                "src": "/assets/md",
              },
              {
                "dest": "/assets/all",
                "src": "/assets/all",
              },
              {
                "dest": "/api/upload",
                "src": "/api/upload",
              },
              {
                "dest": "/api/typed/user/john/post/coffee",
                "src": "/api/typed/user/john/post/coffee",
              },
              {
                "dest": "/api/typed/user/john",
                "src": "/api/typed/user/john",
              },
              {
                "dest": "/api/storage/item",
                "src": "/api/storage/item",
              },
              {
                "dest": "/api/storage/dev",
                "src": "/api/storage/dev",
              },
              {
                "dest": "/api/serialized/void",
                "src": "/api/serialized/void",
              },
              {
                "dest": "/api/serialized/tuple",
                "src": "/api/serialized/tuple",
              },
              {
                "dest": "/api/serialized/set",
                "src": "/api/serialized/set",
              },
              {
                "dest": "/api/serialized/null",
                "src": "/api/serialized/null",
              },
              {
                "dest": "/api/serialized/map",
                "src": "/api/serialized/map",
              },
              {
                "dest": "/api/serialized/function",
                "src": "/api/serialized/function",
              },
              {
                "dest": "/api/serialized/error",
                "src": "/api/serialized/error",
              },
              {
                "dest": "/api/serialized/date",
                "src": "/api/serialized/date",
              },
              {
                "dest": "/api/methods/get",
                "src": "/api/methods/get",
              },
              {
                "dest": "/api/methods/foo.get",
                "src": "/api/methods/foo.get",
              },
              {
                "dest": "/api/methods/default",
                "src": "/api/methods/default",
              },
              {
                "dest": "/api/methods",
                "src": "/api/methods",
              },
              {
                "dest": "/api/meta/test",
                "src": "/api/meta/test",
              },
              {
                "dest": "/api/kebab",
                "src": "/api/kebab",
              },
              {
                "dest": "/api/import-meta",
                "src": "/api/import-meta",
              },
              {
                "dest": "/api/hey",
                "src": "/api/hey",
              },
              {
                "dest": "/api/hello2",
                "src": "/api/hello2",
              },
              {
                "dest": "/api/hello",
                "src": "/api/hello",
              },
              {
                "dest": "/api/headers",
                "src": "/api/headers",
              },
              {
                "dest": "/api/errors",
                "src": "/api/errors",
              },
              {
                "dest": "/api/error",
                "src": "/api/error",
              },
              {
                "dest": "/api/echo",
                "src": "/api/echo",
              },
              {
                "dest": "/api/db",
                "src": "/api/db",
              },
              {
                "dest": "/api/cached",
                "src": "/api/cached",
              },
              {
                "dest": "/500",
                "src": "/500",
              },
              {
                "dest": "/_swagger",
                "src": "/_swagger",
              },
              {
                "dest": "/_scalar",
                "src": "/_scalar",
              },
              {
                "dest": "/_openapi.json",
                "src": "/_openapi.json",
              },
              {
                "dest": "/assets/[id]",
                "src": "/assets/(?<id>[^/]+)",
              },
              {
                "dest": "/api/typed/user/john/post/[postId]",
                "src": "/api/typed/user/john/post/(?<postId>[^/]+)",
              },
              {
                "dest": "/api/typed/user/john/[johnExtends]",
                "src": "/api/typed/user/john/(?<johnExtends>[^/]+)",
              },
              {
                "dest": "/api/typed/user/[userId]/post/firstPost",
                "src": "/api/typed/user/(?<userId>[^/]+)/post/firstPost",
              },
              {
                "dest": "/api/typed/user/[userId]/post/[postId]",
                "src": "/api/typed/user/(?<userId>[^/]+)/post/(?<postId>[^/]+)",
              },
              {
                "dest": "/api/typed/user/[userId]/[userExtends]",
                "src": "/api/typed/user/(?<userId>[^/]+)/(?<userExtends>[^/]+)",
              },
              {
                "dest": "/api/typed/user/[userId]",
                "src": "/api/typed/user/(?<userId>[^/]+)",
              },
              {
                "dest": "/api/test/[-]/foo",
                "src": "/api/test/(?<_0>[^/]*)/foo",
              },
              {
                "dest": "/api/param/[test-id]",
                "src": "/api/param/(?<test>[^/]+)-id",
              },
              {
                "dest": "/tasks/[...name]",
                "src": "/tasks/?(?<name>.+)",
              },
              {
                "dest": "/rules/[...slug]",
                "src": "/rules/?(?<slug>.+)",
              },
              {
                "dest": "/api/wildcard/[...param]",
                "src": "/api/wildcard/?(?<param>.+)",
              },
              {
                "dest": "/api/typed/todos/[...]",
                "src": "/api/typed/todos/?(?<_>.*)",
              },
              {
                "dest": "/api/typed/todos/[todoId]/comments/[...commentId]",
                "src": "/api/typed/todos/(?<todoId>[^/]+)/comments/?(?<commentId>.+)",
              },
              {
                "dest": "/api/typed/catchall/some/[...test]",
                "src": "/api/typed/catchall/some/?(?<test>.+)",
              },
              {
                "dest": "/api/typed/catchall/[slug]/[...another]",
                "src": "/api/typed/catchall/(?<slug>[^/]+)/?(?<another>.+)",
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
