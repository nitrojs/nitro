import { afterAll, describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, rm, stat } from "node:fs/promises";
import { glob } from "tinyglobby";

const fixtureDir = fileURLToPath(new URL("./", import.meta.url));
const tmpDir = fileURLToPath(new URL(".tmp", import.meta.url));

// Rounded up
const bundleSizes: Record<string, [kb: number, minKB: number]> = {
  rollup: [15, 10],
  rolldown: [15, 8],
  vite: [15, 8],
  vite7: [15, 8],
};

describe("minimal fixture", () => {
  const builders = ["rolldown", "rollup", "vite", "vite7"] as const;
  const results: any[] = [];

  for (const builder of builders) {
    for (const minify of [false, true]) {
      describe(`${builder} (${minify ? "minified" : "unminified"})`, () => {
        let buildTime: number, outDir: string;
        it("build", async () => {
          outDir = join(tmpDir, "output", builder + (minify ? "-min" : ""));
          await rm(outDir, { recursive: true, force: true });
          await mkdir(outDir, { recursive: true });
          const nitro = await createNitro({
            rootDir: fixtureDir,
            minify,
            output: { dir: outDir },
            // @ts-expect-error for testing
            __vitePkg__: builder,
            builder: builder.includes("vite") ? "vite" : (builder as "rollup" | "rolldown"),
          });
          await prepare(nitro);
          const start = Date.now();
          await build(nitro);
          buildTime = Date.now() - start;
        });

        it("server entry works", async () => {
          const entry = join(outDir, "server/index.mjs");
          const { fetch } = await import(entry).then((m) => m.default);
          const res = await fetch(new Request("http://localhost/"));
          expect(res.status).toBe(200);
          expect(await res.text()).toBe("ok");
        });

        it("bundle size", async () => {
          const { sizeKB } = await analyzeDir(outDir);
          const expectedSize = bundleSizes[builder]![minify ? 1 : 0];
          expect(Math.round(sizeKB)).within(expectedSize - 1, expectedSize + 1);

          results.push({
            builder: builder + (minify ? " (minified)" : ""),
            size: sizeKB.toFixed(2) + " kB",
            time: `${buildTime}ms`,
          });
        });
      });
    }
  }

  if (process.env.TEST_DEBUG) {
    afterAll(() => {
      console.table(results);
    });
  }
});

async function analyzeDir(cwd: string) {
  const files = await glob("**/*", { cwd, dot: true });
  let sizeBytes = 0;
  await Promise.all(
    files.map(async (file) => {
      const { size } = await stat(join(cwd, file));
      sizeBytes += size;
    })
  );

  return {
    sizeBytes,
    sizeKB: sizeBytes / 1024,
    fileCount: files.length,
  };
}
