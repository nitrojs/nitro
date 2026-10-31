import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { buildFixture, cleanupFixtures } from "../task-cli/_build.ts";
import { checkMainAndSidecar } from "../task-cli/_compat.ts";
import { startCLI, stages, stopChildren } from "../task-cli/_run.ts";

describe("task CLI Vite compatibility", () => {
  afterAll(async () => {
    await stopChildren();
    await cleanupFixtures();
  });
  it.each([
    ["Vite 7", true],
    ["Vite 8", false],
  ] as const)(
    "preserves %s aliases, define, virtual transforms and WebSocket",
    async (_name, vite7) => {
      if (!existsSync(resolve(`node_modules/${vite7 ? "vite7" : "vite"}`))) {
        throw new Error(
          "The compatibility test requires the repository's existing Vite dependency"
        );
      }
      const fixture = await buildFixture({
        builder: "vite",
        inline: vite7,
        vite7,
        probes: true,
        hookDefine: !vite7,
      });
      expect(fixture.counts).toEqual({ before: 1, config: 1, compiled: 1, close: 1 });
      expect(fixture.hookOrder).toEqual(["before", "config", "close", "compiled"]);
      const child = await startCLI(fixture, ["run", "transforms"], { probes: true });
      const result = await child.finished;
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        result: {
          alias: "alias value",
          virtual: "virtual value",
          hook: "hook value",
          define: "vite define",
          environment: "vite environment",
          hookDefine: vite7 ? null : "hook define",
        },
      });
      expect(fixture.serverManifest).toEqual(fixture.serverBeforeManifest);
      expect(stages(result).filter((stage) => stage.startsWith("framework:"))).toEqual([]);
      await checkMainAndSidecar(fixture);
    },
    60_000
  );

  it.each(["rolldown", "vite"] as const)(
    "keeps %s internal prerendering separate from the sidecar",
    async (builder) => {
      const fixture = await buildFixture({ builder, prerender: true, vite7: builder === "vite" });
      expect(JSON.parse(await readFile(join(fixture.outDir, "public/probe"), "utf8"))).toEqual({
        ready: true,
      });
      expect(fixture.info.taskEntry).toBe("tasks/index.mjs");
      const child = await startCLI(fixture, ["run", "transforms"]);
      const result = await child.finished;
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        result: {
          alias: "alias value",
          virtual: "virtual value",
          hook: "hook value",
          define: "vite define",
          environment: builder === "vite" ? "vite environment" : "standalone environment",
          hookDefine: null,
        },
      });
    },
    60_000
  );
  it.each([
    ["Vite 7 middleware", true, "node-middleware"],
    ["Vite 7 cluster", true, "node-cluster"],
    ["Vite 8 middleware", false, "node-middleware"],
    ["Vite 8 cluster", false, "node-cluster"],
  ] as const)(
    "preserves %s HTTP, WebSocket and shutdown",
    async (_name, vite7, preset) => {
      const fixture = await buildFixture({
        builder: "vite",
        vite7,
        preset,
        customOutput: preset === "node-middleware",
        probes: true,
      });
      expect(fixture.counts).toEqual({ before: 1, config: 1, compiled: 1, close: 1 });
      expect(fixture.hookOrder).toEqual(["before", "config", "close", "compiled"]);
      expect(fixture.serverManifest).toMatchObject(fixture.serverBeforeManifest);
      if (preset === "node-cluster") {
        expect(fixture.info.serverEntry).toBe("server/worker.mjs");
        expect(existsSync(join(fixture.outDir, "server/index.mjs"))).toBe(true);
      }
      await checkMainAndSidecar(fixture);
    },
    60_000
  );
});
