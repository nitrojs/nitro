import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { buildFixture, cleanupFixtures } from "../task-cli/_build.ts";
import { startCLI, startMain, stopChildren } from "../task-cli/_run.ts";

const builders = [
  ["rollup", false],
  ["rolldown", false],
  ["vite", true],
  ["vite", false],
] as const;

describe("task CLI output plugin compatibility", () => {
  afterAll(async () => {
    await stopChildren();
    await cleanupFixtures();
  });

  it.each(builders)(
    "preserves %s output.plugins transforms and banner semantics (Vite7=%s)",
    async (builder, vite7) => {
      const fixture = await buildFixture({
        builder,
        vite7,
        preset: builder === "vite" ? "node-server" : "node-middleware",
        inline: builder === "vite" && !vite7,
        customOutput: true,
        outputTransform: true,
      });
      const main = await startMain(fixture);
      if (builder === "vite" && !vite7) {
        expect(fixture.serverFiles.filter((file) => file.endsWith(".mjs"))).toHaveLength(1);
      }
      let primary: unknown;
      try {
        const response = await fetch((await main.waitForListening()) + "/task-output");
        expect(response.status).toBe(200);
        primary = await response.json();
        expect(primary).toEqual({ result: { value: "transformed", banner: "output banner" } });
      } finally {
        main.signal("SIGTERM");
        const result = await main.finished;
        expect(result.code).toBe(0);
      }
      const child = await startCLI(fixture, ["run", "output"]);
      const result = await child.finished;
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual(primary);
    },
    60_000
  );

  it.each(builders)(
    "rejects %s output.plugins redirecting the sidecar (Vite7=%s)",
    async (builder, vite7) => {
      let output = "";
      let failure: unknown;
      try {
        await buildFixture({
          builder,
          vite7,
          outputOverride: true,
          beforeBuild: async (dir) => {
            output = dir;
          },
        });
      } catch (error) {
        failure = error;
      }
      const metadata = join(output, "nitro.json");
      const taskEntry = existsSync(metadata)
        ? JSON.parse(await readFile(metadata, "utf8")).taskEntry
        : undefined;
      console.info(
        "task CLI output guard observation",
        JSON.stringify({ builder, vite7, failed: failure instanceof Error, taskEntry })
      );
      expect(failure).toBeInstanceOf(Error);
      expect(String(failure)).toMatch(/reserved task CLI output contract/);
      expect(taskEntry).toBeUndefined();
    },
    60_000
  );

  it.each(builders)(
    "rejects %s output.plugins changing the sidecar chunk graph (Vite7=%s)",
    async (builder, vite7) => {
      await expect(buildFixture({ builder, vite7, outputTopology: true })).rejects.toThrow(
        /reserved task CLI output contract/
      );
    },
    60_000
  );

  it.each(builders)(
    "rejects nonempty %s output.paths while ordinary builds remain valid (Vite7=%s)",
    async (builder, vite7) => {
      const ordinary = await buildFixture({ builder, vite7, outputPaths: true, enabled: false });
      expect(ordinary.info.taskEntry).toBeUndefined();
      expect(ordinary.serverFiles.length).toBeGreaterThan(0);
      let output = "";
      let failure: unknown;
      try {
        await buildFixture({
          builder,
          vite7,
          outputPaths: true,
          beforeBuild: async (dir) => {
            output = dir;
          },
        });
      } catch (error) {
        failure = error;
      }
      const metadata = join(output, "nitro.json");
      const taskEntry = existsSync(metadata)
        ? JSON.parse(await readFile(metadata, "utf8")).taskEntry
        : undefined;
      console.info(
        "task CLI output paths observation",
        JSON.stringify({
          builder,
          vite7,
          ordinaryBuilt: true,
          failed: failure instanceof Error,
          taskEntry,
        })
      );
      expect(failure).toBeInstanceOf(Error);
      expect(String(failure)).toMatch(/task CLI.*paths|paths.*task CLI/i);
      expect(taskEntry).toBeUndefined();
    },
    60_000
  );
});
