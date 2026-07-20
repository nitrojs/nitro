import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

const fixtureDir = fileURLToPath(new URL("./side-effects-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./side-effects-fixture/.tmp", import.meta.url));

describe("side-effects", () => {
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
          __vitePkg__: builder,
          builder: builder === "vite" ? "vite" : builder,
        });
        await prepare(nitro);
        await build(nitro);
      });

      it("preserves side-effect imports", async () => {
        const entry = join(outDir, "server/index.mjs");
        const { fetch } = await import(entry).then((m) => m.default);
        const res = await fetch(new Request("http://localhost/"));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toMatchObject({ items: ["a", "b"] });
      });
    });
  }
});
