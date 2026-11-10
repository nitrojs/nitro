import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rm, mkdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createNitro, createDevServer, build, prepare } from "nitro/builder";
import type { Nitro } from "nitro/types";
import type { Server } from "srvx";
import type { ViteDevServer } from "vite";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const fixtureDir = fileURLToPath(new URL("./tsconfig-paths-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./tsconfig-paths-fixture/.tmp", import.meta.url));

const expected = (vite: boolean) => ({
  greeting: "Hello from tsconfig paths!",
  sum: 3,
  h3: "function",
  fallback: "fallback",
  aliased: "alias",
  defu: "paths",
  viteAliased: vite ? "vite-alias" : "paths",
  etag: "function",
  xml2js: "function",
});

describe("tsconfig-paths", () => {
  for (const builder of ["rolldown", "rollup", "vite"] as const) {
    describe(builder, () => {
      let outDir: string;

      it("build", async () => {
        outDir = join(tmpDir, builder);
        await rm(outDir, { recursive: true, force: true });
        await mkdir(outDir, { recursive: true });
        const nitro = await createNitro({
          rootDir: fixtureDir,
          output: { dir: outDir },
          // @ts-expect-error for testing
          __vitePkg__: builder === "vite" ? process.env.NITRO_VITE_PKG : undefined,
          builder,
        });
        try {
          await prepare(nitro);
          await build(nitro);
        } finally {
          await nitro.close();
        }
      });

      it("resolves tsconfig `paths`", async () => {
        const entry = join(outDir, "server/index.mjs");
        const { fetch } = await import(entry).then((m) => m.default);
        const res = await fetch(new Request("http://localhost/"));
        expect(await res.json()).toEqual(expected(builder === "vite"));
      });
    });
  }

  it("can be disabled with `typescript.tsconfigPaths: false`", async () => {
    const nitro = await createNitro({
      rootDir: fixtureDir,
      output: { dir: join(tmpDir, "disabled") },
      builder: "rolldown",
      typescript: { tsconfigPaths: false },
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
    const entry = await readFile(join(tmpDir, "disabled/server/index.mjs"), "utf8");
    expect(entry).toMatch(/from ["']@greeting["']/);
  });

  it("warns about invalid `paths` instead of failing", async () => {
    const nitro = await createNitro({
      rootDir: fixtureDir,
      output: { dir: join(tmpDir, "invalid") },
      builder: "rolldown",
      // Non-relative targets require `baseUrl`
      typescript: {
        tsConfig: { compilerOptions: { paths: { "@greeting": ["app/greeting.ts"] } } },
      },
    });
    const warn = vi.spyOn(nitro.logger, "warn");
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Ignoring `compilerOptions.paths` of the project tsconfig")
    );
  });

  describe("vite dev", { concurrent: false }, () => {
    let server: ViteDevServer;
    const originalCwd = process.cwd();

    beforeAll(async () => {
      process.chdir(fixtureDir);
      server = await createServer({ root: fixtureDir, logLevel: "warn" });
      await server.listen("0" as unknown as number);
    }, 30_000);

    afterAll(async () => {
      await server?.close();
      process.chdir(originalCwd);
    });

    it("resolves tsconfig `paths`", async () => {
      const res = await fetch(new URL("/", server.resolvedUrls!.local[0]));
      expect(await res.json()).toEqual(expected(true));
    });
  });

  describe("builder: false", () => {
    let nitro: Nitro;
    let server: Server;

    beforeAll(async () => {
      nitro = await createNitro({
        rootDir: fixtureDir,
        buildDir: join(tmpDir, "unbundled"),
        builder: false,
        dev: true,
      });
      server = createDevServer(nitro).listen({ port: 0 });
      await server.ready();
      const ready = new Promise<void>((resolve) => {
        nitro.hooks.hookOnce("dev:reload", () => resolve());
      });
      await build(nitro);
      await ready;
    });

    afterAll(async () => {
      await nitro?.close();
    });

    it("resolves tsconfig `paths`", async () => {
      const res = await fetch(new URL("/", server.url));
      expect(await res.json()).toEqual(expected(false));
    });
  });
});
