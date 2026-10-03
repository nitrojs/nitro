import type { Nitro } from "nitro/types";
import type { Server } from "srvx";
import {
  build,
  createDevServer,
  createNitro,
  loadOptions,
  prepare,
  prerender,
  startPreview,
} from "nitro/builder";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isUnbundledProject } from "../../src/build/unbundled/detect.ts";
import { unbundledPlugins } from "../../src/build/unbundled/plugins.ts";

const rootDir = fileURLToPath(new URL("fixture", import.meta.url));

describe("builder: false", () => {
  describe("dev", () => {
    let nitro: Nitro;
    let server: Server;
    let reloads = 0;

    beforeAll(async () => {
      nitro = await createNitro({ rootDir, dev: true });
      const devServer = createDevServer(nitro);
      server = devServer.listen({ port: 0 });
      await server.ready();
      const ready = new Promise<void>((resolve) => {
        nitro.hooks.hookOnce("dev:reload", () => resolve());
      });
      await build(nitro);
      await ready;
      nitro.hooks.hook("dev:reload", () => {
        reloads++;
      });
    });

    afterAll(async () => {
      await nitro?.close();
      await rm(join(rootDir, ".data"), { recursive: true, force: true });
      await rm(join(rootDir, "lib/_tmp.ts"), { force: true });
    });

    it("runs TypeScript sources with extensionless imports", async () => {
      const res = await fetch(new URL("/", server.url));
      expect(await res.text()).toBe("Hello, nitro!");
    });

    it("serves virtual modules (routing, runtime config)", async () => {
      const res = await fetch(new URL("/api/42", server.url));
      expect(await res.json()).toEqual({ id: "42", hasRuntimeConfig: true });
    });

    it("applies build transforms (TypeScript, import.meta, alias, text and wasm imports)", async () => {
      const res = await fetch(new URL("/features", server.url));
      expect(await res.json()).toEqual({
        dev: true,
        enum: "green",
        requestURL: "/features",
        text: "text asset",
        wasm: 5,
      });
    });

    it("applies `buildPlugins`", async () => {
      const res = await fetch(new URL("/build-plugins", server.url));
      expect(await res.json()).toEqual({
        message: "Hello from build plugin!",
        transform: "transformed",
      });
    });

    it("serves public assets", async () => {
      const res = await fetch(new URL("/hello.txt", server.url));
      expect(await res.text()).toContain("static asset");
    });

    it("restarts the worker on source changes only", async () => {
      reloads = 0;
      await mkdir(join(rootDir, ".data"), { recursive: true });
      await writeFile(join(rootDir, ".data/state.json"), "{}");
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(reloads).toBe(0);

      await writeFile(join(rootDir, "lib/_tmp.ts"), "export {};");
      await expect.poll(() => reloads, { timeout: 5000 }).toBeGreaterThan(0);
    });
  });

  it("warns about `buildPlugins` hooks env-runner does not support", async () => {
    const nitro = await createNitro({
      rootDir,
      buildPlugins: [
        {
          name: "fixture:unsupported",
          apply: () => true,
          buildStart() {},
          transform: (code) => code,
        },
      ],
    });
    const warn = vi.spyOn(nitro.logger, "warn").mockImplementation(() => {});
    await unbundledPlugins(nitro);
    expect(warn).toHaveBeenCalledWith(
      "Build plugin `fixture:unsupported` uses hooks not supported with `builder: false`, they are ignored: `buildStart`."
    );
    await nitro.close();
  });

  it("maps `NITRO_BUILDER=false` to `builder: false`", async () => {
    const original = process.env.NITRO_BUILDER;
    process.env.NITRO_BUILDER = "false";
    try {
      const options = await loadOptions({ rootDir: join(rootDir, "../..", "fixture") });
      expect(options.builder).toBe(false);
    } finally {
      if (original === undefined) {
        delete process.env.NITRO_BUILDER;
      } else {
        process.env.NITRO_BUILDER = original;
      }
    }
  });

  it("does not support production builds (before cleaning the output)", async () => {
    const nitro = await createNitro({ rootDir });
    await mkdir(nitro.options.output.dir, { recursive: true });
    await expect(prepare(nitro)).rejects.toThrow("not supported with `builder: false`");
    await expect(build(nitro)).rejects.toThrow("not supported with `builder: false`");
    expect(existsSync(nitro.options.output.dir)).toBe(true);
    await rm(nitro.options.output.dir, { recursive: true, force: true });
    await nitro.close();
  });

  it("previews other projects only from their build output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-unbundled-"));
    await writeFile(join(dir, "nitro.config.mjs"), `export default { builder: "vite" };`);
    await expect(startPreview({ rootDir: dir })).rejects.toThrow("Make sure to build first");
    await rm(dir, { recursive: true, force: true });
  });

  it("reports config errors when previewing without a build output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-unbundled-"));
    await writeFile(join(dir, "nitro.config.mjs"), `throw new Error("broken config");`);
    await expect(startPreview({ rootDir: dir })).rejects.toThrow("broken config");
    await rm(dir, { recursive: true, force: true });
  });

  it("detects `builder: false` from `$production`, layers and `NITRO_BUILDER`", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-unbundled-"));
    const config = (code: string) => writeFile(join(dir, "nitro.config.mjs"), code);
    const original = process.env.NITRO_BUILDER;
    delete process.env.NITRO_BUILDER;
    try {
      await config(`export default { $production: { builder: false } };`);
      expect(await isUnbundledProject(dir)).toBe(true);

      await config(`export default { $development: { builder: false } };`);
      expect(await isUnbundledProject(dir)).toBe(false);

      await mkdir(join(dir, "layer"));
      await writeFile(join(dir, "layer/nitro.config.mjs"), `export default { builder: false };`);
      await config(`export default { extends: ["./layer"] };`);
      expect(await isUnbundledProject(dir)).toBe(true);

      await config(`export default {};`);
      process.env.NITRO_BUILDER = "false";
      expect(await isUnbundledProject(dir)).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.NITRO_BUILDER;
      } else {
        process.env.NITRO_BUILDER = original;
      }
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prerenders the sources without a build", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "nitro-unbundled-prerender-"));
    const nitro = await createNitro({
      rootDir,
      output: { dir: outputDir },
      prerender: { routes: ["/", "/api/7", "/features"] },
    });
    try {
      await prerender(nitro);
      const publicDir = nitro.options.output.publicDir;
      expect(await readFile(join(publicDir, "index"), "utf8")).toBe("Hello, nitro!");
      expect(JSON.parse(await readFile(join(publicDir, "api/7"), "utf8"))).toEqual({
        id: "7",
        hasRuntimeConfig: true,
      });
      expect(JSON.parse(await readFile(join(publicDir, "features"), "utf8"))).toMatchObject({
        dev: false,
        enum: "green",
        text: "text asset",
        wasm: 5,
      });
    } finally {
      await nitro.close();
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  describe("preview", () => {
    let preview: Awaited<ReturnType<typeof startPreview>>;
    const outputDir = join(rootDir, ".output");

    beforeAll(async () => {
      // Output left by another builder
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(outputDir, "nitro.json"), JSON.stringify({ preset: "node-server" }));
      preview = await startPreview({ rootDir });
    });

    afterAll(async () => {
      await preview?.close();
      await rm(outputDir, { recursive: true, force: true });
    });

    it("runs the sources without a build", async () => {
      const res = await preview.fetch(new Request("http://localhost/api/1") as any);
      expect(await res.json()).toEqual({ id: "1", hasRuntimeConfig: true });
    });

    it("applies build transforms in production mode", async () => {
      const res = await preview.fetch(new Request("http://localhost/features") as any);
      expect(await res.json()).toMatchObject({ dev: false, enum: "green", wasm: 5 });
    });

    it("serves public assets", async () => {
      const res = await preview.fetch(new Request("http://localhost/hello.txt") as any);
      expect(await res.text()).toContain("static asset");
    });
  });
});
