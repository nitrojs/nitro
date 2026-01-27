import { promises as fsp } from "node:fs";
import { resolve, join, basename } from "pathe";
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { setupTest, testNitro, fixtureDir } from "../tests.ts";
import { toFetchHandler } from "srvx/node";

describe("nitro:preset:vercel:web", async () => {
  const ctx = await setupTest("vercel", {
    outDirSuffix: "-web",
  });
  testNitro(
    ctx,
    async () => {
      const { fetch: fetchHandler } = await import(
        resolve(ctx.outDir, "functions/__server.func/index.mjs")
      ).then((r) => r.default || r);
      return async ({ url, ...options }) => {
        const req = new Request(new URL(url, "https://example.com"), options);
        const res = await fetchHandler(req, {
          waitUntil: vi.fn(),
        });
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
                "dest": "/rules/_/noncached/cached-isr?__isr_route=$__isr_route",
                "src": "(?<__isr_route>/rules/_/noncached/cached)",
              },
              {
                "dest": "/__server",
                "src": "(?<__isr_route>/rules/_/cached/noncached)",
              },
              {
                "dest": "/__server",
                "src": "(?<__isr_route>/rules/_/noncached/(?:.*))",
              },
              {
                "dest": "/rules/_/cached/[...]-isr?__isr_route=$__isr_route",
                "src": "(?<__isr_route>/rules/_/cached/(?:.*))",
              },
              {
                "dest": "/__server",
                "src": "(?<__isr_route>/rules/dynamic)",
              },
              {
                "dest": "/rules/isr/[...]-isr?__isr_route=$__isr_route",
                "src": "(?<__isr_route>/rules/isr/(?:.*))",
              },
              {
                "dest": "/rules/isr-ttl/[...]-isr?__isr_route=$__isr_route",
                "src": "(?<__isr_route>/rules/isr-ttl/(?:.*))",
              },
              {
                "dest": "/rules/swr/[...]-isr?__isr_route=$__isr_route",
                "src": "(?<__isr_route>/rules/swr/(?:.*))",
              },
              {
                "dest": "/rules/swr-ttl/[...]-isr?__isr_route=$__isr_route",
                "src": "(?<__isr_route>/rules/swr-ttl/(?:.*))",
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
                "dest": "/virtual",
                "src": "/virtual",
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
                "dest": "/replace",
                "src": "/replace",
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
                "dest": "/api/storage/item",
                "src": "/api/storage/item",
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
                "dest": "/api/meta/test",
                "src": "/api/meta/test",
              },
              {
                "dest": "/api/kebab",
                "src": "/api/kebab",
              },
              {
                "dest": "/api/hey",
                "src": "/api/hey",
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
                "dest": "/__server",
                "src": "/(.*)",
              },
            ],
            "version": 3,
          }
        `);
      });

      it("should generate prerender config", async () => {
        const isrRouteConfig = await fsp.readFile(
          resolve(ctx.outDir, "functions/rules/isr/[...]-isr.prerender-config.json"),
          "utf8"
        );
        expect(JSON.parse(isrRouteConfig)).toMatchObject({
          expiration: false,
          allowQuery: ["q", "__isr_route"],
        });
      });

      const walkDir = async (path: string): Promise<string[]> => {
        const items: string[] = [];
        const dirname = basename(path);
        const entries = await fsp.readdir(path, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            items.push(`${dirname}/${entry.name}`);
          } else if (entry.isSymbolicLink()) {
            items.push(`${dirname}/${entry.name} (symlink)`);
          } else if (/_\/|_.+|node_modules/.test(entry.name)) {
            items.push(`${dirname}/${entry.name}`);
          } else if (entry.isDirectory()) {
            items.push(...(await walkDir(join(path, entry.name))).map((i) => `${dirname}/${i}`));
          }
        }
        items.sort();
        return items;
      };

      it("should generated expected functions", async () => {
        const functionsDir = resolve(ctx.outDir, "functions");
        const functionsFiles = await walkDir(functionsDir);
        expect(functionsFiles).toMatchInlineSnapshot(`
          [
            "functions/500.func (symlink)",
            "functions/__server.func",
            "functions/_openapi.json.func (symlink)",
            "functions/_scalar.func (symlink)",
            "functions/_swagger.func (symlink)",
            "functions/api/cached.func (symlink)",
            "functions/api/db.func (symlink)",
            "functions/api/echo.func (symlink)",
            "functions/api/error.func (symlink)",
            "functions/api/errors.func (symlink)",
            "functions/api/headers.func (symlink)",
            "functions/api/hello.func (symlink)",
            "functions/api/hey.func (symlink)",
            "functions/api/kebab.func (symlink)",
            "functions/api/meta/test.func (symlink)",
            "functions/api/methods/foo.get.func (symlink)",
            "functions/api/methods/get.func (symlink)",
            "functions/api/param/[test-id].func (symlink)",
            "functions/api/storage/item.func (symlink)",
            "functions/api/test/[-]/foo.func (symlink)",
            "functions/api/upload.func (symlink)",
            "functions/api/wildcard/[...param].func (symlink)",
            "functions/assets/[id].func (symlink)",
            "functions/assets/all.func (symlink)",
            "functions/assets/md.func (symlink)",
            "functions/config.func (symlink)",
            "functions/context.func (symlink)",
            "functions/env.func (symlink)",
            "functions/error-stack.func (symlink)",
            "functions/fetch.func (symlink)",
            "functions/file.func (symlink)",
            "functions/icon.png.func (symlink)",
            "functions/imports.func (symlink)",
            "functions/json-string.func (symlink)",
            "functions/jsx.func (symlink)",
            "functions/modules.func (symlink)",
            "functions/node-compat.func (symlink)",
            "functions/prerender-custom.html.func (symlink)",
            "functions/prerender.func (symlink)",
            "functions/raw.func (symlink)",
            "functions/replace.func (symlink)",
            "functions/route-group.func (symlink)",
            "functions/rules/[...slug].func (symlink)",
            "functions/rules/_/cached/[...]-isr.func (symlink)",
            "functions/rules/_/cached/[...]-isr.prerender-config.json",
            "functions/rules/_/noncached/cached-isr.func (symlink)",
            "functions/rules/_/noncached/cached-isr.prerender-config.json",
            "functions/rules/isr-ttl/[...]-isr.func (symlink)",
            "functions/rules/isr-ttl/[...]-isr.prerender-config.json",
            "functions/rules/isr/[...]-isr.func (symlink)",
            "functions/rules/isr/[...]-isr.prerender-config.json",
            "functions/rules/swr-ttl/[...]-isr.func (symlink)",
            "functions/rules/swr-ttl/[...]-isr.prerender-config.json",
            "functions/rules/swr/[...]-isr.func (symlink)",
            "functions/rules/swr/[...]-isr.prerender-config.json",
            "functions/static-flags.func (symlink)",
            "functions/stream.func (symlink)",
            "functions/tasks/[...name].func (symlink)",
            "functions/virtual.func (symlink)",
            "functions/wait-until.func (symlink)",
            "functions/wasm/dynamic-import.func (symlink)",
            "functions/wasm/static-import.func (symlink)",
          ]
        `);
      });
    }
  );
});

describe("nitro:preset:vercel:node", async () => {
  const ctx = await setupTest("vercel", {
    outDirSuffix: "-node",
    config: {
      vercel: { entryFormat: "node" },
    },
  });
  testNitro(ctx, async () => {
    const nodeHandler = await import(resolve(ctx.outDir, "functions/__server.func/index.mjs")).then(
      (r) => r.default || r
    );
    const fetchHandler = toFetchHandler(nodeHandler);
    return async ({ url, ...options }) => {
      const req = new Request(new URL(url, "https://example.com"), options);
      const res = await fetchHandler(req);
      return res;
    };
  });
});

describe("nitro:preset:vercel:bun", async () => {
  const ctx = await setupTest("vercel", {
    outDirSuffix: "-bun",
    config: {
      preset: "vercel",
      vercel: {
        functions: {
          runtime: "bun1.x",
        },
      },
    },
  });

  it("should generate function config with bun runtime", async () => {
    const config = await fsp
      .readFile(resolve(ctx.outDir, "functions/__server.func/.vc-config.json"), "utf8")
      .then((r) => JSON.parse(r));
    expect(config).toMatchInlineSnapshot(`
      {
        "handler": "index.mjs",
        "launcherType": "Nodejs",
        "runtime": "bun1.x",
        "shouldAddHelpers": false,
        "supportsResponseStreaming": true,
      }
    `);
  });
});

describe.skip("nitro:preset:vercel:bun-verceljson", async () => {
  const vercelJsonPath = join(fixtureDir, "vercel.json");

  const ctx = await setupTest("vercel", {
    outDirSuffix: "-bun-verceljson",
    config: {
      preset: "vercel",
    },
  });

  beforeAll(async () => {
    // Need to make sure vercel.json is created before setupTest is called
    await fsp.writeFile(vercelJsonPath, JSON.stringify({ bunVersion: "1.x" }));
  });

  afterAll(async () => {
    await fsp.unlink(vercelJsonPath).catch(() => {});
  });

  it("should detect bun runtime from vercel.json", async () => {
    const config = await fsp
      .readFile(resolve(ctx.outDir, "functions/__server.func/.vc-config.json"), "utf8")
      .then((r) => JSON.parse(r));
    expect(config).toMatchInlineSnapshot(`
      {
        "handler": "index.mjs",
        "launcherType": "Nodejs",
        "runtime": "bun1.x",
        "shouldAddHelpers": false,
        "supportsResponseStreaming": true,
      }
    `);
  });
});
