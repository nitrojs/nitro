import { promises as fsp } from "node:fs";
import { Server, type RequestListener } from "node:http";
import { tmpdir } from "node:os";
import { formatDate } from "compatx";
import type { DateString } from "compatx";
import { defu } from "defu";
import destr from "destr";
import { fileURLToPath } from "mlly";
import {
  build,
  copyPublicAssets,
  createDevServer,
  createNitro,
  prepare,
  prerender,
} from "nitro/builder";
import type { Nitro, NitroConfig } from "nitro/types";
import { fetch } from "ofetch";
import type { FetchOptions } from "ofetch";
import { join, resolve } from "pathe";
import { isWindows } from "std-env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

export interface Context {
  preset: string;
  nitro?: Nitro;
  rootDir: string;
  outDir: string;
  fetch: (url: string, opts?: FetchOptions) => Promise<any>;
  server?: { url: string; close: () => Promise<void> };
  isDev: boolean;
  isWorker: boolean;
  isLambda: boolean;
  isIsolated: boolean;
  supportsEnv: boolean;
  env: Record<string, string>;
  lambdaV1?: boolean;
  // [key: string]: unknown;
}

// https://github.com/nitrojs/nitro/pull/1240
export const describeIf = (condition: boolean, title: string, factory: () => any) =>
  condition
    ? describe(title, factory)
    : describe(title, () => {
        it.skip("skipped", () => {
          // Ignore
        });
      });

export const fixtureDir = fileURLToPath(new URL("fixture", import.meta.url).href);

export const getPresetTmpDir = (preset: string) => {
  if (preset.startsWith("cloudflare")) {
    return fileURLToPath(new URL(`.tmp/${preset}`, import.meta.url) as any /* remove me */);
  }

  return resolve(process.env.NITRO_TEST_TMP_DIR || join(tmpdir(), "nitro-tests"), preset);
};

export async function setupTest(
  preset: string,
  opts: {
    config?: NitroConfig;
    compatibilityDate?: DateString;
    outDirSuffix?: string;
  } = {}
) {
  const presetTmpDir = getPresetTmpDir(preset + (opts.outDirSuffix || ""));

  await fsp.rm(presetTmpDir, { recursive: true }).catch(() => {
    // Ignore
  });
  await fsp.mkdir(presetTmpDir, { recursive: true });

  const ctx: Context = {
    preset,
    isDev: preset === "nitro-dev",
    isWorker: [
      "cloudflare-worker",
      "cloudflare-module",
      "cloudflare-module-legacy",
      "cloudflare-pages",
      "netlify-edge",
      "vercel-edge",
      "winterjs",
    ].includes(preset),
    isLambda: ["aws-lambda", "netlify-legacy"].includes(preset),
    isIsolated: ["winterjs"].includes(preset),
    supportsEnv: !["winterjs"].includes(preset),
    rootDir: fixtureDir,
    outDir: resolve(fixtureDir, presetTmpDir, ".output"),
    env: {
      NITRO_HELLO: "world",
      CUSTOM_HELLO_THERE: "general",
      SECRET: "secret",
      APP_DOMAIN: "test.com",
      NITRO_DYNAMIC: "from-env",
    },
    fetch: (url, opts) =>
      fetch(new URL(url, ctx.server!.url), {
        redirect: "manual",
        ...(opts as any),
      }),
  };

  // Set environment variables for process compatible presets
  for (const [name, value] of Object.entries(ctx.env)) {
    process.env[name] = value;
  }

  const config = defu(opts.config, {
    preset: ctx.preset,
    dev: ctx.isDev,
    rootDir: ctx.rootDir,
    runtimeConfig: {
      nitro: {
        envPrefix: "CUSTOM_",
      },
      hello: "",
      helloThere: "",
    },
    buildDir: resolve(fixtureDir, presetTmpDir, ".nitro"),
    serveStatic: !ctx.isDev && !ctx.isWorker,
    output: {
      dir: ctx.outDir,
    },
  });
  const nitro = (ctx.nitro = await createNitro(config, {
    compatibilityDate: opts.compatibilityDate || formatDate(new Date()),
  }));

  if (ctx.isDev) {
    // Setup development server
    const devServer = createDevServer(ctx.nitro);
    const server = await devServer.listen({});
    ctx.server = {
      url: server.url!,
      close: () => server.close(),
    };
    await prepare(ctx.nitro);
    const ready = new Promise<void>((resolve) => {
      ctx.nitro!.hooks.hook("dev:reload", () => resolve());
    });
    await build(ctx.nitro);
    await ready;
  } else {
    // Production build
    await prepare(nitro);
    await copyPublicAssets(nitro);
    await prerender(nitro);
    await build(nitro);
  }

  afterAll(async () => {
    if (ctx.server) {
      await ctx.server.close();
    }
    if (ctx.nitro) {
      await ctx.nitro.close();
    }
  });

  return ctx;
}

export async function startServer(ctx: Context, handle: RequestListener) {
  const server = new Server(handle);
  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, () => resolve());
  });
  const port = (server.address() as any).port;
  ctx.server = {
    url: `http://localhost:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      }),
  };
}

type TestHandlerResult = {
  data: any;
  status: number;
  headers: Record<string, string | string[]>;
};
type TestHandler = (options: any) => Promise<TestHandlerResult | Response>;

export function testNitro(
  ctx: Context,
  getHandler: () => TestHandler | Promise<TestHandler>,
  additionalTests?: (
    ctx: Context,
    callHandler: (options: any) => Promise<TestHandlerResult>
  ) => void
) {
  let _handler: TestHandler;

  async function callHandler(
    options: any,
    callOpts: { binary?: boolean } = {}
  ): Promise<TestHandlerResult> {
    const result = await _handler(options);
    if (
      !(result instanceof Response) &&
      !["Response", "_Response"].includes(result.constructor.name)
    ) {
      throw new TypeError("Expected Response");
    }

    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of (result as Response).headers.entries()) {
      if (headers[key]) {
        if (!Array.isArray(headers[key])) {
          headers[key] = [headers[key] as string];
        }
        if (Array.isArray(value)) {
          (headers[key] as string[]).push(...value);
        } else {
          (headers[key] as string[]).push(value);
        }
      } else {
        headers[key] = value;
      }
    }
    headers["set-cookie"] = (result as Response).headers.getSetCookie();

    return {
      data: callOpts.binary
        ? Buffer.from(await (result as Response).arrayBuffer())
        : destr(await (result as Response).text()),
      status: result.status,
      headers,
    };
  }

  beforeAll(async () => {
    _handler = await getHandler();
  }, 25_000);

  it("Server entry works", async () => {
    const { data, headers } = await callHandler({ url: "/" });
    expect(data).toBe("server entry works!");
    expect(headers["x-test"]).toBe("test");
  });

  it("API Works", async () => {
    const { data: helloData } = await callHandler({ url: "/api/hello" });
    expect(helloData).to.toMatchObject({ message: "Hello API" });

    if (ctx.nitro?.options.serveStatic) {
      // /api/hey is expected to be prerendered
      const { data: heyData } = await callHandler({ url: "/api/hey" });
      expect(heyData).to.have.string("Hey API");
    }

    const { data: kebabData } = await callHandler({ url: "/api/kebab" });
    expect(kebabData).to.have.string("hello-world");

    const { data: paramsData } = await callHandler({
      url: "/api/param/test_param",
    });
    expect(paramsData).toBe("test_param");

    const { data: paramsData2 } = await callHandler({
      url: "/api/wildcard/foo/bar/baz",
    });
    expect(paramsData2).toBe("foo/bar/baz");
  });

  it("group routes", async () => {
    const { status } = await callHandler({ url: "/route-group" });
    expect(status).toBe(200);
    const { status: apiStatus } = await callHandler({
      url: "/route-group",
    });
    expect(apiStatus).toBe(200);
  });

  it("Handle 404 not found", async () => {
    const res = await callHandler({ url: "/api/not-found" });
    expect(res.status).toBe(404);
  });

  it("Virtual route", async () => {
    const res = await callHandler({ url: "/virtual" });
    expect(res.status).toBe(200);
    expect(res.data).toBe("Hello from virtual entry!");
  });

  // TODO
  it.todo("Handle 405 method not allowed", async () => {
    const res = await callHandler({ url: "/api/upload" });
    expect(res.status).toBe(405);
  });

  it("handles route rules - redirects", async () => {
    const base = await callHandler({ url: "/rules/redirect" });
    expect(base.status).toBe(307);
    expect(base.headers.location).toBe("/base");

    const obj = await callHandler({ url: "/rules/redirect/obj" });
    expect(obj.status).toBe(308);
    expect(obj.headers.location).toBe("https://nitro.build/");

    const wildcard = await callHandler({
      url: "/rules/redirect/wildcard/nuxt",
    });
    expect(wildcard.status).toBe(307);
    expect(wildcard.headers.location).toBe("https://nitro.build/nuxt");
  });

  it("binary response", async () => {
    const { data } = await callHandler({ url: "/icon.png" }, { binary: true });
    // Check if buffer is a png
    function isBufferPng(buffer: Buffer) {
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    }
    expect(isBufferPng(data)).toBe(true);
  });

  it.skipIf(
    // TODO: srvx reverse-compat bug with streaming?
    ctx.preset === "vercel" && ctx.nitro?.options.vercel?.entryFormat === "node"
  )("render JSX", async () => {
    const { data } = await callHandler({ url: "/jsx" });
    expect(data).toMatch(/<h1 class="test".*>Hello JSX!<\/h1>/);
  });

  it("replace", async () => {
    const { data } = await callHandler({ url: "/replace" });
    expect(data).toMatchObject({ window: false });
  });

  it.runIf(ctx.nitro?.options.serveStatic)("handles custom Vary header", async () => {
    let headers = (
      await callHandler({
        url: "/foo.css",
        headers: { "Accept-Encoding": "gzip" },
      })
    ).headers;
    if (headers["vary"]) {
      expect(headers["vary"].includes("Origin")).toBeTruthy();
      expect(headers["vary"].includes("Accept-Encoding")).toBeTruthy();
    }

    headers = (
      await callHandler({
        url: "/foo.css",
        headers: { "Accept-Encoding": "" },
      })
    ).headers;
    if (headers["vary"]) {
      expect(headers["vary"]).toBe("Origin");
    }

    headers = (
      await callHandler({
        url: "/foo.js",
        headers: { "Accept-Encoding": "gzip" },
      })
    ).headers;
    if (headers["vary"]) {
      expect(headers["vary"].includes("Origin")).toBeTruthy();
      expect(headers["vary"].includes("Accept-Encoding")).toBeTruthy();
    }
  });

  it("handles route rules - headers", async () => {
    const { headers } = await callHandler({ url: "/rules/headers" });
    expect(headers["cache-control"]).toBe("s-maxage=60");
  });

  it("handles route rules - cors", async () => {
    const expectedHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET",
      "access-control-allow-headers": "*",
      "access-control-max-age": "0",
    };
    const { headers } = await callHandler({ url: "/rules/cors" });
    expect(headers).toMatchObject(expectedHeaders);
  });

  it("handles route rules - allowing overriding", async () => {
    const override = await callHandler({ url: "/rules/nested/override" });
    expect(override.headers.location).toBe("/other");
    expect(override.headers["x-test"]).toBe("test");

    const base = await callHandler({ url: "/rules/nested/base" });
    expect(base.headers.location).toBe("/base");
    expect(base.headers["x-test"]).toBe("test");
  });

  it("handles errors", async () => {
    const { status, headers } = await callHandler({
      url: "/api/error",
      headers: {
        Accept: "application/json",
      },
    });
    expect(status).toBe(503);

    expect(headers).toMatchObject({
      "content-type": "application/json",
      "content-security-policy": ctx.isDev
        ? "script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self';"
        : "script-src 'none'; frame-ancestors 'none';",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });

    const { data } = await callHandler({
      url: "/api/error?json",
    });
    expect(status).toBe(503);
    expect(data.json.error).toBe(true);
  });

  it.skipIf(
    // TODO!
    ctx.preset === "vercel" && ctx.nitro?.options.vercel?.entryFormat === "node" && isWindows
  )("handles custom server assets", async () => {
    const { data: html, status: htmlStatus } = await callHandler({
      url: "/file?filename=index.html",
    });
    expect(htmlStatus).toBe(200);
    expect(html).toContain("<h1>nitro is amazing!</h1>");

    const { data: txtFile, status: txtStatus } = await callHandler({
      url: "/file?filename=test.txt",
    });
    expect(txtStatus).toBe(200);
    expect(txtFile).toContain("this is an asset from a text file from nitro");

    const { data: mdFile, status: mdStatus } = await callHandler({
      url: "/assets/md",
    });
    expect(mdStatus).toBe(200);
    expect(mdFile).toContain("# Hello world");
  });

  if (ctx.nitro!.options.serveStatic) {
    it("serve static asset /favicon.ico", async () => {
      const { status, headers } = await callHandler({ url: "/favicon.ico" });
      expect(status).toBe(200);
      expect(headers.etag).toBeDefined();
      expect(headers["content-type"]).toBe("image/vnd.microsoft.icon");
    });

    it("serve static asset /build/test.txt", async () => {
      const { status, headers } = await callHandler({ url: "/build/test.txt" });
      expect(status).toBe(200);
      expect(headers.etag).toBe('"7-vxGfAKTuGVGhpDZqQLqV60dnKPw"');
      expect(headers["content-type"]).toBe("text/plain; charset=utf-8");
    });

    it("stores content-type for prerendered routes", async () => {
      const { data, headers } = await callHandler({
        url: "/api/param/prerender4",
      });
      expect(data).toBe("prerender4");
      expect(headers["content-type"]).toBe("text/plain; custom");
    });
  }

  it("shows 404 for /build/non-file", async () => {
    const { status } = await callHandler({ url: "/build/non-file" });
    expect(status).toBe(404);
  });

  it("find auto imported utils", async () => {
    const res = await callHandler({ url: "/imports" });
    expect(res.data).toMatchObject({
      testUtil: 123,
      testNestedUtil: 1234 + 12_345,
    });
  });

  it.skipIf(ctx.preset === "deno-server")("resolve module version conflicts", async () => {
    const { data } = await callHandler({ url: "/modules" });
    expect(data).toMatchObject({
      depA: "@fixture/nitro-lib@1.0.0+@fixture/nested-lib@1.0.0",
      depB: "@fixture/nitro-lib@2.0.1+@fixture/nested-lib@2.0.1",
      depLib: "@fixture/nitro-lib@2.0.0+@fixture/nested-lib@2.0.0",
      subpathLib: "@fixture/nitro-lib@2.0.0",
      extraUtils: "@fixture/nitro-utils/extra",
    });
  });

  it.skipIf(ctx.isIsolated)("useStorage (with base)", { retry: 5 }, async () => {
    const putRes = await callHandler({
      url: "/api/storage/item?key=test:hello",
      method: "PUT",
      body: `"world"`,
    });
    expect(putRes.data).toBe("world");

    expect(
      (
        await callHandler({
          url: "/api/storage/item?key=:",
        })
      ).data
    ).toMatchObject(["test:hello"]);

    expect(
      (
        await callHandler({
          url: "/api/storage/item?base=test&key=:",
        })
      ).data
    ).toMatchObject(["hello"]);

    expect(
      (
        await callHandler({
          url: "/api/storage/item?base=test&key=hello",
        })
      ).data
    ).toBe("world");
  });

  if (additionalTests) {
    additionalTests(ctx, callHandler);
  }

  it("runtime proxy", async () => {
    const { data } = await callHandler({
      url: "/api/proxy?foo=bar",
      headers: {
        "x-test": "foobar",
      },
    });
    expect(data.url).toBe("/api/echo?foo=bar");
    if (!(ctx.preset === "vercel" && ctx.nitro?.options.vercel?.entryFormat === "node")) {
      // TODO: Investigate why headers are missing in this case
      expect(data.headers["x-test"]).toBe("foobar");
    }
  });

  it.skipIf(ctx.preset === "bun" /* TODO */)("stream", async () => {
    const { data } = await callHandler({
      url: "/stream",
    });
    expect(data).toBe("nitroisawesome");
  });

  it.skipIf(!ctx.supportsEnv)("config", async () => {
    const { data } = await callHandler({
      url: "/config",
    });
    expect(data).toMatchObject({
      runtimeConfig: {
        dynamic: "from-env",
        url: "https://test.com",
        app: {
          baseURL: "/",
        },
      },
      sharedRuntimeConfig: {
        dynamic: ctx.preset === "cloudflare-module-legacy" ? "initial" : "from-env",
        // url: "https://test.com",
        app: {
          baseURL: "/",
        },
      },
    });
  });

  it("static build flags", async () => {
    const { data } = await callHandler({ url: "/static-flags" });
    expect(data).toMatchObject({
      dev: ctx.isDev,
      preset: ctx.preset,
      prerender: false,
      nitro: true,
      server: true,
      client: false,
      baseURL: "/",
      _asyncContext: true,
      _tasks: true,
    });
  });

  it("event.waitUntil", async () => {
    const res = await callHandler({ url: "/wait-until" });
    expect(res.data).toBe("done");
  });

  describe("ignore", () => {
    it("server routes should be ignored", async () => {
      expect((await callHandler({ url: "/api/_ignored" })).status).toBe(404);
      expect((await callHandler({ url: "/_ignored" })).status).toBe(404);
    });

    it.skipIf(ctx.isWorker || ctx.isDev)("public files should be ignored", async () => {
      expect((await callHandler({ url: "/_ignored.txt" })).status).toBe(404);
      expect((await callHandler({ url: "/favicon.ico" })).status).toBe(200);
    });
  });

  describe("headers", () => {
    it("handles headers correctly", async () => {
      const { headers } = await callHandler({ url: "/api/headers" });
      expect(headers["x-foo"]).toBe("bar");
      expect(headers["x-array"]).toMatch(/^foo,\s?bar$/);
      const expectedCookies: string | string[] = [
        "foo=bar",
        "bar=baz",
        "test=value; Path=/",
        "test2=value; Path=/",
      ];
      expect(headers["set-cookie"]).toMatchObject(expectedCookies);
    });
  });

  describe("errors", () => {
    it.skipIf(ctx.isIsolated)("captures errors", async () => {
      const { data } = await callHandler({ url: "/api/errors" });
      const allErrorMessages = (data.allErrors || []).map((entry: any) => entry.message);
      expect(allErrorMessages).to.includes("Service Unavailable");
    });

    it.skipIf(
      !ctx.nitro!.options.node ||
        // TODO: Investigate
        ctx.preset === "bun" ||
        ctx.preset === "deno-server" ||
        ctx.preset === "nitro-dev"
    )("sourcemap works", async () => {
      const { data } = await callHandler({ url: "/error-stack" });
      expect(data.stack).toMatch("test/fixture/server/routes/error-stack.ts");
    });
  });

  describe("async context", () => {
    it.skipIf(!ctx.nitro!.options.node)("works", async () => {
      const { data } = await callHandler({ url: "/context?foo" });
      expect(data).toMatchObject({
        context: {
          path: "/context?foo",
        },
      });
    });
  });

  describe.skipIf(!ctx.supportsEnv)("environment variables", () => {
    it("can load environment variables from runtimeConfig", async () => {
      const { data } = await callHandler({ url: "/config" });
      expect(data.runtimeConfig.hello).toBe("world");
      expect(data.runtimeConfig.helloThere).toBe("general");
      expect(data.runtimeConfig.secret).toBeUndefined();
    });
  });

  describe("cache", () => {
    it.skipIf(ctx.isIsolated || (isWindows && ctx.preset === "nitro-dev"))(
      "should setItem before returning response the first time",
      async () => {
        const {
          data: { timestamp },
        } = await callHandler({ url: "/api/cached" });

        // TODO
        // expect(eventContextCache?.options.swr).toBe(true);

        const calls = await Promise.all([
          callHandler({ url: "/api/cached" }),
          callHandler({ url: "/api/cached" }),
          callHandler({ url: "/api/cached" }),
        ]);

        for (const call of calls) {
          expect(call.data.timestamp).toBe(timestamp);
          // TODO
          // expect(call.data.eventContextCache.options.swr).toBe(true);
        }
      }
    );
  });

  describe("scanned files", () => {
    it("Allow having extra method in file name", async () => {
      expect((await callHandler({ url: "/api/methods/get" })).data).toBe("get");
      expect((await callHandler({ url: "/api/methods/foo.get" })).data).toBe("foo.get");
    });
  });

  describe.skipIf(ctx.preset === "cloudflare-worker")("wasm", () => {
    it("dynamic import wasm", async () => {
      expect((await callHandler({ url: "/wasm/dynamic-import" })).data).toBe("2+3=5");
    });

    it("static import wasm", async () => {
      expect((await callHandler({ url: "/wasm/static-import" })).data).toBe("2+3=5");
    });
  });

  describe.skipIf(
    isWindows ||
      !ctx.nitro!.options.node ||
      ctx.isLambda ||
      ctx.isWorker ||
      ["bun", "deno-server", "deno-deploy", "netlify", "netlify-legacy"].includes(ctx.preset)
  )("Database", () => {
    it("works", async () => {
      const { data } = await callHandler({ url: "/api/db" });
      expect(data).toMatchObject({
        rows: [
          {
            id: "1001",
            firstName: "John",
            lastName: "Doe",
            email: "",
          },
        ],
      });
    });
  });

  describe("Environment specific routes", () => {
    it("filters based on dev|prod", async () => {
      const { data } = await callHandler({ url: "/env" });
      expect(data).toBe(ctx.isDev ? "dev env" : "prod env");
    });
  });

  it("raw imports", async () => {
    const { data } = await callHandler({ url: "/raw" });
    expect(data).toMatchObject({
      sql: "--",
      sqlts: "--",
    });
  });

  it.skipIf(
    process.env.OFFLINE /* connect */ ||
      ["cloudflare-worker", "cloudflare-module-legacy"].includes(ctx.preset)
  )("nodejs compatibility", async () => {
    const { data, status } = await callHandler({ url: "/node-compat" });
    expect(status).toBe(200);
    for (const key in data) {
      if (ctx.preset === "vercel-edge" && key === "crypto:createHash") {
        continue;
      }
      if (ctx.preset === "deno-server" && key === "globals:BroadcastChannel") {
        continue; // unstable API
      }
      if (
        ctx.preset.includes("cloudflare") &&
        key.startsWith("globals:") &&
        ctx.nitro!.options.builder === "rolldown"
      ) {
        continue;
      }
      expect(data[key], key).toBe(true);
    }
  });
}
