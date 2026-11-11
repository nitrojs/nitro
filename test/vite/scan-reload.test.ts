import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { nitro } from "../../src/vite.ts";
import { publicAssetCase, scanDirCases, writeFiles } from "../unit/_scan-dirs.ts";
import type { Fetch } from "../unit/_scan-dirs.ts";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite: scan dirs reload", { concurrent: false }, () => {
  let server: ViteDevServer;
  let fetchPath: Fetch;
  const tmpDir = fileURLToPath(new URL(".tmp", import.meta.url));
  let rootDir: string;

  beforeAll(async () => {
    mkdirSync(tmpDir, { recursive: true });
    rootDir = mkdtempSync(join(tmpDir, "scan-reload-"));
    writeFiles(rootDir, {
      "package.json": JSON.stringify({ type: "module" }),
      ...Object.assign({}, ...scanDirCases.map((c) => c.files)),
    });
    server = await createServer({
      root: rootDir,
      configFile: false,
      logLevel: "warn",
      plugins: [nitro({ serverDir: "./", experimental: { tasks: true } })],
    });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    const serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
    fetchPath = (path) => fetch(serverURL + path);
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  test.each(scanDirCases)("picks up added, removed and re-added files in `$dir/`", async (c) => {
    const expectState = async (expected: unknown) => {
      const deadline = Date.now() + 10_000;
      let state = await c.observe(fetchPath);
      while (!isDeepStrictEqual(state, expected) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        state = await c.observe(fetchPath);
      }
      expect(state).toEqual(expected);
    };

    await expectState(c.removed);

    writeFiles(rootDir, { [c.file]: c.contents });
    await expectState(c.added);

    rmSync(join(rootDir, c.file));
    await expectState(c.removed);

    writeFiles(rootDir, { [c.file]: c.contents });
    await expectState(c.added);

    rmSync(join(rootDir, c.file));
    await expectState(c.removed);
  });
});

describe("vite: deleted public asset", () => {
  let server: ViteDevServer;
  let fetchPath: Fetch;
  const tmpDir = fileURLToPath(new URL(".tmp", import.meta.url));
  let rootDir: string;

  beforeAll(async () => {
    mkdirSync(tmpDir, { recursive: true });
    rootDir = mkdtempSync(join(tmpDir, "public-asset-"));
    writeFiles(rootDir, {
      "package.json": JSON.stringify({ type: "module" }),
      ...publicAssetCase.files,
    });
    server = await createServer({
      root: rootDir,
      configFile: false,
      logLevel: "warn",
      plugins: [nitro({ serverDir: "./" })],
    });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    const serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
    fetchPath = (path) => fetch(serverURL + path);
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  test("is no longer served", async () => {
    expect(await publicAssetCase.observe(fetchPath)).toEqual(publicAssetCase.existing);
    rmSync(join(rootDir, publicAssetCase.file));
    expect(await publicAssetCase.observe(fetchPath)).toEqual(publicAssetCase.removed);
  });
});
