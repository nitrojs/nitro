import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFile, readdir, rm, mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

const fixtureDir = fileURLToPath(new URL("./static-preset-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./static-preset-fixture/.tmp", import.meta.url));

describe("static preset", () => {
  const outDir = join(tmpDir, "vite");

  it("build", async () => {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const nitro = await createNitro({
      rootDir: fixtureDir,
      output: { dir: outDir },
      builder: "vite",
    });
    await prepare(nitro);
    await build(nitro);
  });

  it("does not emit a server bundle", async () => {
    expect((await readdir(outDir)).sort()).toEqual(["nitro.json", "public"]);
  });

  it("prerenders routes to the public dir", async () => {
    const html = await readFile(join(outDir, "public/index.html"), "utf8");
    expect(html).toContain("<h1>prerendered</h1>");
  });
});
