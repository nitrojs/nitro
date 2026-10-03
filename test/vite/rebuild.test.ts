import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "pathe";
import { describe, expect, it } from "vitest";

const { createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:rebuild", () => {
  const rootDir = fileURLToPath(new URL("./rebuild-fixture", import.meta.url));

  // https://github.com/nitrojs/nitro/issues/4679
  it("rebuilds when build.outDir is inside the output dir", async () => {
    await rm(join(rootDir, "dist"), { recursive: true, force: true });
    const cwd = process.cwd();
    process.chdir(rootDir);
    try {
      for (let i = 0; i < 2; i++) {
        const builder = await createBuilder({ root: rootDir, logLevel: "warn" });
        await builder.buildApp();
      }
    } finally {
      process.chdir(cwd);
    }
    expect(existsSync(join(rootDir, "dist/server/index.mjs"))).toBe(true);
  }, 60_000);
});
