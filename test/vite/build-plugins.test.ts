import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

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
});
