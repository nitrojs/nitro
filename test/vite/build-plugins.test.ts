import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";
import { getBundlerConfig } from "../../src/build/vite/bundler.ts";
import type { NitroPluginContext } from "../../src/build/vite/types.ts";

const fixtureDir = fileURLToPath(new URL("./build-plugins-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./build-plugins-fixture/.tmp", import.meta.url));

describe("buildPlugins", () => {
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
          builder,
          // @ts-expect-error for testing
          __vitePkg__: process.env.NITRO_VITE_PKG,
        });
        await prepare(nitro);
        await build(nitro);
        await nitro.close();
      });

      it("applies plugins from config, promises and modules, ordered by `enforce`", async () => {
        const entry = join(outDir, "server/index.mjs");
        const { fetch } = await import(entry).then((m) => m.default);
        const res = await fetch(new Request("http://localhost/"));
        expect(await res.json()).toEqual({
          // `pre` plugins run before Nitro's virtual modules, the others after them
          pre: "pre",
          normal: "nitro",
          post: "nitro",
          module: "module",
          promise: "promise",
        });
      });
    });
  }

  // Vite on Rollup (Vite 7) adds the Rollup-only plugins in its own merge
  it("places `pre` plugins before the Rollup-only plugins with Vite on Rollup", async () => {
    const nitro = await createNitro({ rootDir: fixtureDir, builder: "vite" });
    const { rollupConfig } = await getBundlerConfig({
      nitro,
      _isRolldown: false,
    } as NitroPluginContext);
    const names = (rollupConfig!.plugins as { name: string }[]).map((p) => p.name);
    expect(names.slice(0, 3)).toEqual(["fixture:pre", "inject", "alias"]);
    expect(names.at(-1)).toBe("fixture:post");
    await nitro.close();
  });
});
