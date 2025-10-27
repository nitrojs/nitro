import { afterAll, describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, rm, stat } from "node:fs/promises";
import { glob } from "tinyglobby";
import { isWindows } from "std-env";

const fixtureDir = fileURLToPath(new URL("./", import.meta.url));
const tmpDir = fileURLToPath(new URL(".tmp", import.meta.url));

const sizeThresholds: Record<string, [number, number]> = {
  rollup: [20, 14],
  rolldown: [146, 146],
  vite: [22, 12],
};

if (isWindows) {
  // Add 1kB more to thresholds on Windows
  for (const key in sizeThresholds) {
    sizeThresholds[key][0] += 1;
    sizeThresholds[key][1] += 1;
  }
}

describe("minimal fixture", () => {
  const builders = ["rollup", "rolldown", "vite"] as const;

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
            builder,
            minify,
            output: { dir: outDir },
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

        it("output size", async () => {
          const { sizeKB } = await analyzeDir(outDir);
          const threshold = sizeThresholds[builder][minify ? 1 : 0];
          expect(sizeKB).toBeLessThan(threshold);

          results.push({
            builder: builder + (minify ? " (minified)" : ""),
            size: sizeKB.toFixed(2) + " kB",
            time: `${buildTime}ms`,
          });
        });
      });
    }
  }

  if (process.env.DEBUG) {
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
