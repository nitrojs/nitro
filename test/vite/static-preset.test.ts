import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, rm, mkdir } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

const fixtureDir = fileURLToPath(new URL("./static-preset-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./static-preset-fixture/.tmp", import.meta.url));

const presets = {
  static: "public",
  "github-pages": "public",
  "vercel-static": "static",
  "cloudflare-pages-static": ".",
};

describe.each(Object.entries(presets))("static preset (%s)", (preset, publicDir) => {
  const outDir = join(tmpDir, preset);

  beforeAll(async () => {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const nitro = await createNitro({
      rootDir: fixtureDir,
      preset,
      output: { dir: outDir },
      builder: "vite",
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
  });

  it("does not emit a server bundle", () => {
    expect(existsSync(join(outDir, "server"))).toBe(false);
  });

  it("prerenders routes to the public dir", async () => {
    const html = await readFile(join(outDir, publicDir, "index.html"), "utf8");
    expect(html).toContain("<h1>prerendered</h1>");
  });
});
