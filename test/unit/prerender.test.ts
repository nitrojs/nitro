import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNitro, prepare, prerender } from "nitropack/core";

describe("prerender", () => {
  let rootDir: string;

  beforeAll(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-prerender-"));
    await mkdir(join(rootDir, "routes/api"), { recursive: true });
    await writeFile(
      join(rootDir, "routes/api/[...id].ts"),
      `export default defineEventHandler((event) => ({ id: event.context.params.id }));\n`
    );
  });

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("prerenders filenames containing `..` but not `..` segments", async () => {
    const nitro = await createNitro({
      rootDir,
      preset: "static",
      logLevel: 0,
      prerender: {
        crawlLinks: false,
        routes: [
          "/api/hello..png",
          "/api/7/../8",
          "/api/7\\..\\9",
          "/api/7/%2e%2e/10",
        ],
      },
    });
    try {
      await prepare(nitro);
      await prerender(nitro);
      const publicDir = nitro.options.output.publicDir;
      expect(
        JSON.parse(await readFile(join(publicDir, "api/hello..png"), "utf8"))
      ).toMatchObject({ id: "hello..png" });
      expect(existsSync(join(publicDir, "api/8"))).toBe(false);
      expect(existsSync(join(publicDir, "api/9"))).toBe(false);
      expect(existsSync(join(publicDir, "api/10"))).toBe(false);
      expect(existsSync(join(publicDir, "api/7"))).toBe(false);
    } finally {
      await nitro.close();
    }
  });
});
