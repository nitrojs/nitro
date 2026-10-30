import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { buildFixture, cleanupFixtures } from "../task-cli/_build.ts";
import { allFiles } from "../task-cli/_artifact.ts";
import { configureOutputBoundary, emittedSource } from "../task-cli/_build-boundary.ts";
import { startCLI, startMain, stopChildren } from "../task-cli/_run.ts";

const builders = [
  ["rollup", false],
  ["rolldown", false],
  ["vite", true],
  ["vite", false],
] as const;

describe("task CLI resolved environment and output boundaries", () => {
  afterAll(async () => {
    await stopChildren();
    await cleanupFixtures();
  });

  it.each(builders)(
    "keeps the primary %s environment snapshot after a late option change (Vite7=%s)",
    async (builder, vite7) => {
      const fixture = await buildFixture({
        builder,
        vite7,
        configure: async (nitro) => {
          await writeFile(
            join(nitro.options.rootDir, "server/routes/probe.ts"),
            `import { defineHandler } from "nitro";
import { FastResponse } from "srvx";
export default defineHandler(() => ({ fastResponse: Response === FastResponse }));
`
          );
          nitro.hooks.hook("build:config", () => {
            nitro.options.polyfills.push("!#nitro/runtime/polyfills/fast-response");
          });
        },
      });
      const main = await startMain(fixture);
      let primary: unknown;
      try {
        const response = await fetch((await main.waitForListening()) + "/probe");
        expect(response.status).toBe(200);
        primary = await response.json();
        expect(primary).toEqual({ fastResponse: true });
      } finally {
        main.signal("SIGTERM");
        const result = await main.finished;
        expect(result.code).toBe(0);
        expect(result.signal).toBeNull();
      }
      const child = await startCLI(fixture, ["run", "environment"]);
      const result = await child.finished;
      expect(result.code).toBe(0);
      expect(result.signal).toBeNull();
      const sidecar = JSON.parse(result.stdout).result;
      console.info(
        "task CLI environment snapshot observation",
        JSON.stringify({ builder, vite7, primary, sidecar })
      );
      expect(sidecar).toEqual(primary);
      expect(sidecar).toEqual({ fastResponse: true });
    },
    60_000
  );

  it.each(builders)(
    "emits runnable isolated %s assets and sourcemaps (Vite7=%s)",
    async (builder, vite7) => {
      const fixture = await buildFixture({
        builder,
        vite7,
        configure: (nitro) => configureOutputBoundary(nitro, "assetFileNames", () => {}, false),
      });
      const files = await allFiles(join(fixture.outDir, "tasks"));
      const asset = files.find((file) => /\/assets\/boundary-emitted-[^/]+\.map$/.test(file));
      expect(asset).toBeDefined();
      expect(await readFile(asset!, "utf8")).toBe(emittedSource);
      const maps = files.filter((file) => file.endsWith(".map") && file !== asset);
      expect(maps.length).toBeGreaterThan(0);
      for (const file of maps) {
        const map = JSON.parse(await readFile(file, "utf8"));
        expect(map.version).toBe(3);
        expect(map.sources.length).toBeGreaterThan(0);
      }
      const child = await startCLI(fixture, ["run", "environment"]);
      const result = await child.finished;
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ result: { fastResponse: true } });
    },
    60_000
  );

  for (const field of ["assetFileNames", "sourcemapFileNames"] as const) {
    it.each(builders)(
      `rejects %s post outputOptions changing reserved ${field} (Vite7=%s)`,
      async (builder, vite7) => {
        let ordinaryOverrides = 0;
        const ordinary = await buildFixture({
          builder,
          vite7,
          enabled: false,
          configure: (nitro) => {
            configureOutputBoundary(nitro, field, () => ordinaryOverrides++);
          },
        });
        expect(ordinary.info.taskEntry).toBeUndefined();
        expect(ordinaryOverrides).toBe(0);
        const emittedAsset = ordinary.serverFiles.find((file) =>
          /\/boundary-emitted-[^/]+\.map$/.test(file)
        );
        expect(emittedAsset).toBeDefined();
        expect(await readFile(emittedAsset!, "utf8")).toBe(emittedSource);
        const sourceMaps = ordinary.serverFiles.filter(
          (file) => file.endsWith(".map") && file !== emittedAsset
        );
        expect(sourceMaps.length).toBeGreaterThan(0);
        if (field === "assetFileNames") {
          expect(emittedAsset).toContain("/primary-layout/");
        } else {
          const generatedMap = sourceMaps.find((file) => file.includes("/primary-layout/"));
          expect(generatedMap).toBeDefined();
          const map = JSON.parse(await readFile(generatedMap!, "utf8"));
          expect(map.version).toBe(3);
          expect(map.sources.length).toBeGreaterThan(0);
        }

        let output = "";
        let overrides = 0;
        let failure: unknown;
        try {
          await buildFixture({
            builder,
            vite7,
            configure: (nitro) => {
              configureOutputBoundary(nitro, field, () => overrides++);
            },
            beforeBuild: async (dir) => {
              output = dir;
            },
          });
        } catch (error) {
          failure = error;
        }
        expect(output).not.toBe("");
        expect(overrides).toBeGreaterThan(0);
        const metadata = join(output, "nitro.json");
        const taskEntry = existsSync(metadata)
          ? JSON.parse(await readFile(metadata, "utf8")).taskEntry
          : undefined;
        console.info(
          "task CLI output layout observation",
          JSON.stringify({
            builder,
            vite7,
            field,
            ordinaryBuilt: true,
            overrides,
            failure: String(failure),
            taskEntry,
          })
        );
        expect(failure).toBeInstanceOf(Error);
        expect(String(failure)).toMatch(/reserved task CLI output contract/);
        expect(taskEntry).toBeUndefined();
      },
      60_000
    );
  }
});
