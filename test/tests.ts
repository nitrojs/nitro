import { promises as fsp } from "node:fs";
import type { RequestListener } from "node:http";
import { tmpdir } from "node:os";
import { type DateString, formatDate } from "compatx";
import { defu } from "defu";
import destr from "destr";
import { type Listener, listen } from "listhen";
import { fileURLToPath } from "mlly";
import {
  build,
  copyPublicAssets,
  createDevServer,
  createNitro,
  prepare,
  prerender,
} from "nitropack/core";
import type { Nitro, NitroConfig } from "nitropack/types";
import { type FetchOptions, fetch } from "ofetch";
import { join, resolve } from "pathe";
import { isWindows, nodeMajorVersion } from "std-env";
import { joinURL } from "ufo";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

export interface Context {
  preset: string;
  nitro?: Nitro;
  rootDir: string;
  outDir: string;
  fetch: (url: string, opts?: FetchOptions) => Promise<any>;
  server?: Listener;
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
export const describeIf = (
  condition: boolean,
  title: string,
  factory: () => any
) =>
  condition
    ? describe(title, factory)
    : describe(title, () => {
        it.skip("skipped", () => {
          // Ignore
        });
      });

export const fixtureDir = fileURLToPath(
  new URL("fixture", import.meta.url).href
);

export const getPresetTmpDir = (preset: string) => {
  if (preset.startsWith("cloudflare")) {
    return fileURLToPath(
      new URL(`.tmp/${preset}`, import.meta.url) as any /* remove me */
    );
  }

  return resolve(
    process.env.NITRO_TEST_TMP_DIR || join(tmpdir(), "nitro-tests"),
    preset
  );
};

export async function setupTest(
  preset: string,
  opts: { config?: NitroConfig; compatibilityDate?: DateString } = {}
) {
  const presetTmpDir = getPresetTmpDir(preset);

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
      fetch(joinURL(ctx.server!.url, url.slice(1)), {
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
    timing: !ctx.isWorker,
  });
  const nitro = (ctx.nitro = await createNitro(config, {
    compatibilityDate: opts.compatibilityDate || formatDate(new Date()),
  }));

  if (ctx.isDev) {
    // Setup development server
    const devServer = createDevServer(ctx.nitro);
    ctx.server = await devServer.listen({});
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
  ctx.server = await listen(handle);
  console.log(">", ctx.server!.url);
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
  additionalTests?: (ctx: Context, callHandler: TestHandler) => void
) {
  let _handler: TestHandler;

  async function callHandler(
    options: any,
    callOpts: { binary?: boolean } = {}
  ): Promise<TestHandlerResult> {
    const result = await _handler(options);
    if (!["Response", "_Response"].includes(result.constructor.name)) {
      return result as TestHandlerResult;
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

  it("Handle 405 method not allowed", async () => {
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
    let buffer: Buffer;
    if (ctx.isLambda) {
      // TODO: Handle base64 decoding in lambda tests themselves
      expect(typeof data).toBe("string");
      buffer = Buffer.from(data, "base64");
    } else {
      buffer = data;
    }
    // Check if buffer is a png
    function isBufferPng(buffer: Buffer) {
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    }
    expect(isBufferPng(buffer)).toBe(true);
  });

  it("render JSX", async () => {
    const { data } = await callHandler({ url: "/jsx" });
    expect(data).toMatch("<h1 >Hello JSX!</h1>");
  });

  it.skipIf(ctx.preset.startsWith('cloudflare') || ctx.preset === 'vercel-edge')(
    "handles custom Vary header",
    async () => {
      let headers = (await callHandler({ url: "/foo.css", headers: { "Accept-Encoding": "gzip" } })).headers;
      if (headers["vary"]) expect(headers["vary"].includes('Origin') && headers["vary"].includes('Accept-Encoding')).toBeTruthy();

      headers = (await callHandler({ url: "/foo.css", headers: { "Accept-Encoding": "" } })).headers;
      if (headers["vary"]) expect(headers["vary"]).toBe("Origin");

      headers = (await callHandler({ url: "/foo.js", headers: { "Accept-Encoding": "gzip" } })).headers;
      if (headers["vary"]) expect(headers["vary"].includes('Origin') && headers["vary"].includes('Accept-Encoding')).toBeTruthy();
    }
  );

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
    const { status } = await callHandler({
      url: "/api/error",
      headers: {
        Accept: "application/json",
      },
    });
    expect(status).toBe(503);
  });

  it("universal import.meta", async () => {
    const { status, data } = await callHandler({ url: "/api/import-meta" });
    expect(status).toBe(200);
    expect(data.testFile).toMatch(/[/\\]test.txt$/);
    expect(data.hasEnv).toBe(true);
  });

  it("handles custom server assets", async () => {
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
      expect(headers["content-type"]).toBe("text/plain; charset=utf-16");
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
    });
  });

  it.skipIf(ctx.preset === "deno-server")(
    "resolve module version conflicts",
    async () => {
      const { data } = await callHandler({ url: "/modules" });
      expect(data).toMatchObject({
        depA: "@fixture/nitro-lib@1.0.0+@fixture/nested-lib@1.0.0",
        depB: "@fixture/nitro-lib@2.0.1+@fixture/nested-lib@2.0.1",
        depLib: "@fixture/nitro-lib@2.0.0+@fixture/nested-lib@2.0.0",
        subpathLib: "@fixture/nitro-lib@2.0.0",
        extraUtils: "@fixture/nitro-utils/extra",
      });
    }
  );

  it.skipIf(ctx.isIsolated)("useStorage (with base)", async () => {
    const putRes = await callHandler({
      url: "/api/storage/item?key=test:hello",
      method: "PUT",
      body: "world",
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
    expect(data.headers["x-test"]).toBe("foobar");
    expect(data.url).toBe("/api/echo?foo=bar");
  });

  it.skipIf(ctx.preset === "bun" /* TODO */)("stream", async () => {
    const { data } = await callHandler({
      url: "/stream",
    });
    expect(data).toBe(ctx.isLambda ? btoa("nitroisawesome") : "nitroisawesome");
  });

  it.skipIf(!ctx.supportsEnv)("config", async () => {
    const { data } = await callHandler({
      url: "/config",
    });
    expect(data).toMatchObject({
      appConfig: {
        dynamic: "from-middleware",
        "app-config": true,
        "nitro-config": true,
        "server-config": true,
      },
      runtimeConfig: {
        dynamic: "from-env",
        url: "https://test.com",
        app: {
          baseURL: "/",
        },
      },
      sharedAppConfig: {
        dynamic: "initial",
        "app-config": true,
        "nitro-config": true,
        "server-config": true,
      },
      sharedRuntimeConfig: {
        // Cloudflare environment variables are set after first request
        dynamic:
          ctx.preset.includes("cloudflare") &&
          ctx.preset !== "cloudflare-worker"
            ? "initial"
            : "from-env",
        // url: "https://test.com",
        app: {
          baseURL: "/",
        },
      },
    });
  });

  if (ctx.nitro!.options.timing) {
    it("set server timing header", async () => {
      const { status, headers } = await callHandler({
        url: "/api/hello",
      });
      expect(status).toBe(200);
      expect(headers["server-timing"]).toMatch(/-;dur=\d+;desc="Generate"/);
    });
  }

  it("static build flags", async () => {
    const { data } = await callHandler({ url: "/static-flags" });
    expect(data).toMatchObject({
      dev: [ctx.isDev, ctx.isDev],
      preset: [ctx.preset, ctx.preset],
      prerender: [
        ctx.preset === "nitro-prerenderer",
        ctx.preset === "nitro-prerenderer",
      ],
      client: [false, false],
      nitro: [true, true],
      server: [true, true],
      "versions.nitro": [expect.any(String), expect.any(String)],
      "versions?.nitro": [expect.any(String), expect.any(String)],
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

    it.skipIf(ctx.isWorker || ctx.isDev)(
      "public files should be ignored",
      async () => {
        expect((await callHandler({ url: "/_ignored.txt" })).status).toBe(404);
        expect((await callHandler({ url: "/favicon.ico" })).status).toBe(200);
      }
    );

    it.skipIf(ctx.isWorker || ctx.isDev)(
      "public files can be un-ignored with patterns",
      async () => {
        expect((await callHandler({ url: "/_unignored.txt" })).status).toBe(
          200
        );
      }
    );
  });

  describe("headers", () => {
    it("handles headers correctly", async () => {
      const { headers } = await callHandler({ url: "/api/headers" });
      expect(headers["content-type"]).toBe("text/html");
      expect(headers["x-foo"]).toBe("bar");
      expect(headers["x-array"]).toMatch(/^foo,\s?bar$/);

      let expectedCookies: string | string[] = [
        "foo=bar",
        "bar=baz",
        "test=value; Path=/",
        "test2=value; Path=/",
      ];

      // TODO: Node presets do not split cookies
      // https://github.com/nitrojs/nitro/issues/1462
      // (vercel and deno-server uses node only for tests only)
      const notSplittingPresets = [
        "node-listener",
        "nitro-dev",
        "vercel",
        (nodeMajorVersion || 0) < 18 && "deno-server",
        (nodeMajorVersion || 0) < 18 && "bun",
      ].filter(Boolean);
      if (notSplittingPresets.includes(ctx.preset)) {
        expectedCookies =
          (nodeMajorVersion || 0) < 18
            ? "foo=bar, bar=baz, test=value; Path=/, test2=value; Path=/"
            : ["foo=bar, bar=baz", "test=value; Path=/", "test2=value; Path=/"];
      }

      // TODO: vercel-edge joins all cookies for some reason!
      if (typeof expectedCookies === "string") {
        expect(headers["set-cookie"]).toBe(expectedCookies);
      } else {
        expect((headers["set-cookie"] as string[]).join(", ")).toBe(
          expectedCookies.join(", ")
        );
      }
    });
  });

  describe("errors", () => {
    it.skipIf(ctx.isIsolated)("captures errors", async () => {
      const { data } = await callHandler({ url: "/api/errors" });
      const allErrorMessages = (data.allErrors || []).map(
        (entry: any) => entry.message
      );
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
      expect(data.stack).toMatch("test/fixture/routes/error-stack.ts");
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
    it.skipIf(ctx.isIsolated)(
      "should setItem before returning response the first time",
      async () => {
        const {
          data: { timestamp, eventContextCache },
        } = await callHandler({ url: "/api/cached" });

        expect(eventContextCache?.options.swr).toBe(true);

        const calls = await Promise.all([
          callHandler({ url: "/api/cached" }),
          callHandler({ url: "/api/cached" }),
          callHandler({ url: "/api/cached" }),
        ]);

        for (const call of calls) {
          expect(call.data.timestamp).toBe(timestamp);
          expect(call.data.eventContextCache.options.swr).toBe(true);
        }
      }
    );
  });

  describe("scanned files", () => {
    it("Allow having extra method in file name", async () => {
      expect((await callHandler({ url: "/api/methods/get" })).data).toBe("get");
      expect((await callHandler({ url: "/api/methods/foo.get" })).data).toBe(
        "foo.get"
      );
    });
  });

  describe.skipIf(ctx.preset === "cloudflare-worker")("wasm", () => {
    it("dynamic import wasm", async () => {
      expect((await callHandler({ url: "/wasm/dynamic-import" })).data).toBe(
        "2+3=5"
      );
    });

    it("static import wasm", async () => {
      expect((await callHandler({ url: "/wasm/static-import" })).data).toBe(
        "2+3=5"
      );
    });
  });

  describe.skipIf(
    isWindows ||
      !ctx.nitro!.options.node ||
      ctx.isLambda ||
      ctx.isWorker ||
      [
        "bun",
        "deno-server",
        "deno-deploy",
        "netlify",
        "netlify-legacy",
      ].includes(ctx.preset)
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
}
