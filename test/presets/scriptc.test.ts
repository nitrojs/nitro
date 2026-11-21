import { execa } from "execa";
import { getRandomPort } from "get-port-please";
import type { ResultPromise } from "execa";
import { build, copyPublicAssets, createNitro, prepare } from "nitro/builder";
import { rename, rm } from "node:fs/promises";
import { resolve } from "pathe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPresetTmpDir, setupTest, testNitro } from "../tests.ts";
import { waitForServer } from "./_wait-for-server.ts";

// The fixture uses features and libraries that scriptc can't compile yet: run the bundle
// (with the same patches as the native build) with Node.js.
describe("nitro:preset:scriptc", async () => {
  const ctx = await setupTest("scriptc", { config: { scriptc: { compile: false } } });
  testNitro(ctx, async () => {
    const port = await getRandomPort();
    const entry = resolve(ctx.outDir, "server/index.mjs");
    const p = execa("node", ["--enable-source-maps", entry], {
      env: { PORT: String(port) },
      stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
      reject: false,
    });
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: async () => {
        p.kill();
      },
    } as any;
    await waitForServer(`http://127.0.0.1:${port}/`, p.nodeChildProcess);
    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });
});

// Native executable (set `SCRIPTC` to the path of `scriptc`)
describe.runIf(process.env.SCRIPTC)("nitro:preset:scriptc (native)", { timeout: 300_000 }, () => {
  const rootDir = resolve(import.meta.dirname, "fixtures/scriptc");
  const outDir = resolve(getPresetTmpDir("scriptc-native"), ".output");
  let url: string;
  let child: ResultPromise | undefined;

  beforeAll(async () => {
    const nitro = await createNitro({
      rootDir,
      preset: "scriptc",
      output: { dir: outDir },
      buildDir: resolve(outDir, "../.nitro"),
    });
    await prepare(nitro);
    await copyPublicAssets(nitro);
    await build(nitro);
    await nitro.close();

    // The binary must not depend on the location it was built in
    const movedDir = resolve(outDir, "../.output-moved");
    await rm(movedDir, { recursive: true, force: true });
    await rename(outDir, movedDir);

    const port = await getRandomPort();
    url = `http://127.0.0.1:${port}`;
    child = execa(resolve(movedDir, "server/index"), {
      env: { PORT: String(port) },
      stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
      reject: false,
    });
    await waitForServer(`${url}/`, child.nodeChildProcess);
  }, 300_000);

  afterAll(() => {
    child?.kill();
  });

  const get = (path: string, init?: RequestInit) =>
    fetch(url + path, { redirect: "manual", ...init });

  it("renders routes", async () => {
    const res = await get("/");
    expect(await res.text()).toBe("Hello from scriptc!");
    expect(res.headers.get("x-plugin")).toBe("1");
  });

  it("reads route params, context and body", async () => {
    const res = await get("/api/test", { method: "POST", body: "payload" });
    expect(await res.json()).toEqual({ name: "test", user: "nitro", body: "payload" });
  });

  it("reads runtime config and query", async () => {
    const res = await get("/api/config?foo=bar");
    expect(await res.json()).toEqual({ greeting: "hello", query: { foo: "bar" } });
  });

  it("uses storage", async () => {
    const res = await get("/api/kv");
    expect(await res.json()).toEqual({ value: 1 });
  });

  it("caches handlers", async () => {
    const first = await (await get("/api/cached")).json();
    const res = await get("/api/cached");
    expect(await res.json()).toEqual(first);
    expect(res.headers.get("x-cache")).toBe("HIT");
  });

  it("handles errors", async () => {
    const error = await get("/api/error");
    expect(error.status).toBe(418);
    expect(await error.json()).toMatchObject({ message: "teapot" });
    const crash = await get("/api/crash");
    expect(crash.status).toBe(500);
    const notFound = await get("/not-found");
    expect(notFound.status).toBe(404);
  });

  it("streams responses", async () => {
    expect(await (await get("/api/stream")).text()).toBe("ab");
  });

  it("applies route rules", async () => {
    const headers = await get("/rules/headers");
    expect(headers.headers.get("x-rule")).toBe("1");
    const redirect = await get("/rules/redirect");
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("location")).toBe("/");
  });

  it("serves public assets", async () => {
    const res = await get("/static.txt");
    expect(await res.text()).toBe("static file\n");
    expect(res.headers.get("etag")).toBeTruthy();
    const range = await get("/static.txt", { headers: { range: "bytes=0-5" } });
    expect(range.status).toBe(206);
    expect(await range.text()).toBe("static");
  });

  it("reads server assets", async () => {
    const res = await get("/api/asset");
    expect(await res.text()).toBe("server asset\n");
  });
});
