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
                "dest": "/__routes__/wasm/static-import",
                "src": "/wasm/static-import",
              },
              {
                "dest": "/__routes__/wasm/dynamic-import",
                "src": "/wasm/dynamic-import",
              },
              {
                "dest": "/__routes__/wait-until",
                "src": "/wait-until",
              },
              {
                "dest": "/__routes__/stream",
                "src": "/stream",
              },
              {
                "dest": "/__routes__/static-flags",
                "src": "/static-flags",
              },
              {
                "dest": "/__routes__/route-group",
                "src": "/route-group",
              },
              {
                "dest": "/__routes__/raw",
                "src": "/raw",
              },
              {
                "dest": "/__routes__/prerender-custom.html",
                "src": "/prerender-custom.html",
              },
              {
                "dest": "/__routes__/prerender",
                "src": "/prerender",
              },
              {
                "dest": "/__routes__/node-compat",
                "src": "/node-compat",
              },
              {
                "dest": "/__routes__/modules",
                "src": "/modules",
              },
              {
                "dest": "/__routes__/jsx",
                "src": "/jsx",
              },
              {
                "dest": "/__routes__/json-string",
                "src": "/json-string",
              },
              {
                "dest": "/__routes__/imports",
                "src": "/imports",
              },
              {
                "dest": "/__routes__/icon.png",
                "src": "/icon.png",
              },
              {
                "dest": "/__routes__/file",
                "src": "/file",
              },
              {
                "dest": "/__routes__/fetch",
                "src": "/fetch",
              },
              {
                "dest": "/__routes__/error-stack",
                "src": "/error-stack",
              },
              {
                "dest": "/__routes__/env",
                "src": "/env",
              },
              {
                "dest": "/__routes__/context",
                "src": "/context",
              },
              {
                "dest": "/__routes__/config",
                "src": "/config",
              },
              {
                "dest": "/__routes__/assets/md",
                "src": "/assets/md",
              },
              {
                "dest": "/__routes__/assets/all",
                "src": "/assets/all",
              },
              {
                "dest": "/__routes__/api/upload",
                "src": "/api/upload",
              },
              {
                "dest": "/__routes__/api/typed/user/john/post/coffee",
                "src": "/api/typed/user/john/post/coffee",
              },
              {
                "dest": "/__routes__/api/typed/user/john",
                "src": "/api/typed/user/john",
              },
              {
                "dest": "/__routes__/api/storage/item",
                "src": "/api/storage/item",
              },
              {
                "dest": "/__routes__/api/storage/dev",
                "src": "/api/storage/dev",
              },
              {
                "dest": "/__routes__/api/serialized/void",
                "src": "/api/serialized/void",
              },
              {
                "dest": "/__routes__/api/serialized/tuple",
                "src": "/api/serialized/tuple",
              },
              {
                "dest": "/__routes__/api/serialized/set",
                "src": "/api/serialized/set",
              },
              {
                "dest": "/__routes__/api/serialized/null",
                "src": "/api/serialized/null",
              },
              {
                "dest": "/__routes__/api/serialized/map",
                "src": "/api/serialized/map",
              },
              {
                "dest": "/__routes__/api/serialized/function",
                "src": "/api/serialized/function",
              },
              {
                "dest": "/__routes__/api/serialized/error",
                "src": "/api/serialized/error",
              },
              {
                "dest": "/__routes__/api/serialized/date",
                "src": "/api/serialized/date",
              },
              {
                "dest": "/__routes__/api/methods/get",
                "src": "/api/methods/get",
              },
              {
                "dest": "/__routes__/api/methods/foo.get",
                "src": "/api/methods/foo.get",
              },
              {
                "dest": "/__routes__/api/methods/default",
                "src": "/api/methods/default",
              },
              {
                "dest": "/__routes__/api/methods",
                "src": "/api/methods",
              },
              {
                "dest": "/__routes__/api/meta/test",
                "src": "/api/meta/test",
              },
              {
                "dest": "/__routes__/api/kebab",
                "src": "/api/kebab",
              },
              {
                "dest": "/__routes__/api/import-meta",
                "src": "/api/import-meta",
              },
              {
                "dest": "/__routes__/api/hey",
                "src": "/api/hey",
              },
              {
                "dest": "/__routes__/api/hello2",
                "src": "/api/hello2",
              },
              {
                "dest": "/__routes__/api/hello",
                "src": "/api/hello",
              },
              {
                "dest": "/__routes__/api/headers",
                "src": "/api/headers",
              },
              {
                "dest": "/__routes__/api/errors",
                "src": "/api/errors",
              },
              {
                "dest": "/__routes__/api/error",
                "src": "/api/error",
              },
              {
                "dest": "/__routes__/api/echo",
                "src": "/api/echo",
              },
              {
                "dest": "/__routes__/api/db",
                "src": "/api/db",
              },
              {
                "dest": "/__routes__/api/cached",
                "src": "/api/cached",
              },
              {
                "dest": "/__routes__/500",
                "src": "/500",
              },
              {
                "dest": "/__routes__/_swagger",
                "src": "/_swagger",
              },
              {
                "dest": "/__routes__/_scalar",
                "src": "/_scalar",
              },
              {
                "dest": "/__routes__/_openapi.json",
                "src": "/_openapi.json",
              },
              {
                "dest": "/__routes__/assets/[id]",
                "src": "/assets/(?<id>[^/]+)",
              },
              {
                "dest": "/__routes__/api/typed/user/john/post/[postId]",
                "src": "/api/typed/user/john/post/(?<postId>[^/]+)",
              },
              {
                "dest": "/__routes__/api/typed/user/john/[johnExtends]",
                "src": "/api/typed/user/john/(?<johnExtends>[^/]+)",
              },
              {
                "dest": "/__routes__/api/typed/user/[userId]/post/firstPost",
                "src": "/api/typed/user/(?<userId>[^/]+)/post/firstPost",
              },
              {
                "dest": "/__routes__/api/typed/user/[userId]/post/[postId]",
                "src": "/api/typed/user/(?<userId>[^/]+)/post/(?<postId>[^/]+)",
              },
              {
                "dest": "/__routes__/api/typed/user/[userId]/[userExtends]",
                "src": "/api/typed/user/(?<userId>[^/]+)/(?<userExtends>[^/]+)",
              },
              {
                "dest": "/__routes__/api/typed/user/[userId]",
                "src": "/api/typed/user/(?<userId>[^/]+)",
              },
              {
                "dest": "/__routes__/api/test/[-]/foo",
                "src": "/api/test/(?<_0>[^/]*)/foo",
              },
              {
                "dest": "/__routes__/api/param/[test-id]",
                "src": "/api/param/(?<test>[^/]+)-id",
              },
              {
                "dest": "/__routes__/tasks/[...name]",
                "src": "/tasks/?(?<name>.+)",
              },
              {
                "dest": "/__routes__/rules/[...slug]",
                "src": "/rules/?(?<slug>.+)",
              },
              {
                "dest": "/__routes__/api/wildcard/[...param]",
                "src": "/api/wildcard/?(?<param>.+)",
              },
              {
                "dest": "/__routes__/api/typed/todos/[...]",
                "src": "/api/typed/todos/?(?<_>.*)",
              },
              {
                "dest": "/__routes__/api/typed/todos/[todoId]/comments/[...commentId]",
                "src": "/api/typed/todos/(?<todoId>[^/]+)/comments/?(?<commentId>.+)",
              },
              {
                "dest": "/__routes__/api/typed/catchall/some/[...test]",
                "src": "/api/typed/catchall/some/?(?<test>.+)",
              },
              {
                "dest": "/__routes__/api/typed/catchall/[slug]/[...another]",
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
