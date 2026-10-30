import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { createNitro } from "nitro/builder";
import { buildFixture, cleanupFixtures } from "../task-cli/_build.ts";
import { startCLI, stopChildren } from "../task-cli/_run.ts";
import { checkMainAndSidecar } from "../task-cli/_compat.ts";

describe("task CLI build compatibility", () => {
  afterAll(async () => {
    await stopChildren();
    await cleanupFixtures();
  });

  it.each([
    ["server inline", { inline: true }],
    ["server custom output", { customOutput: true }],
    ["middleware custom output", { preset: "node-middleware", customOutput: true }],
    ["cluster inline", { preset: "node-cluster", inline: true }],
  ] as Array<[string, NonNullable<Parameters<typeof buildFixture>[0]>]>)(
    "keeps the main %s behavior and isolates the sidecar",
    async (_name, options) => {
      const fixture = await buildFixture({ ...options, probes: true });
      expect(fixture.counts).toEqual({ before: 1, config: 1, compiled: 1, close: 1 });
      expect(fixture.hookOrder).toEqual(["before", "config", "compiled", "close"]);
      expect(fixture.info.taskEntry).toBe("tasks/index.mjs");
      expect(Object.keys(fixture.serverBeforeManifest).length).toBeGreaterThan(0);
      expect(fixture.serverManifest).toMatchObject(fixture.serverBeforeManifest);
      if (options.inline) {
        const entryCount = fixture.serverFiles.filter((file) => file.endsWith(".mjs")).length;
        expect(entryCount).toBe(options.preset === "node-cluster" ? 2 : 1);
      }
      if (options.preset === "node-cluster") {
        expect(fixture.info.serverEntry).toBe("server/worker.mjs");
        await expect(access(join(fixture.outDir, "server/index.mjs"))).resolves.toBeUndefined();
        await expect(access(join(fixture.outDir, "server/worker.mjs"))).resolves.toBeUndefined();
      }
      await checkMainAndSidecar(fixture);
    },
    60_000
  );

  it("supports the node alias and leaves disabled builds without a sidecar", async () => {
    const alias = await buildFixture({ preset: "node" });
    expect(alias.info.preset).toBe("node-server");
    expect(alias.info.taskEntry).toBe("tasks/index.mjs");
    const child = await startCLI(alias, ["run", "echo:payload"]);
    expect((await child.finished).code).toBe(0);
    const disabled = await buildFixture({ enabled: false });
    expect(disabled.info.taskEntry).toBeUndefined();
    await expect(access(disabled.entry)).rejects.toHaveProperty("code", "ENOENT");
    expect(disabled.info.serverEntry).toBe("server/index.mjs");
    expect(alias.serverManifest).toEqual(alias.serverBeforeManifest);
    expect(disabled.serverManifest).toEqual(disabled.serverBeforeManifest);
  }, 60_000);

  it("preserves explicit polyfill removal", async () => {
    const normal = await buildFixture();
    const removed = await buildFixture({ noFastResponse: true });
    for (const [fixture, expected] of [
      [normal, true],
      [removed, false],
    ] as const) {
      const child = await startCLI(fixture, ["run", "environment"]);
      const result = await child.finished;
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ result: { fastResponse: expected } });
    }
  }, 60_000);

  it("does not overwrite an existing sidecar output directory", async () => {
    let sentinel = "";
    await expect(
      buildFixture({
        beforeBuild: async (output) => {
          await mkdir(join(output, "tasks"), { recursive: true });
          sentinel = join(output, "tasks/index.mjs");
          await writeFile(sentinel, "keep this user file");
        },
      })
    ).rejects.toThrow(/Task CLI output directory already exists/);
    expect(await readFile(sentinel, "utf8")).toBe("keep this user file");
  }, 60_000);

  it.each([
    { preset: "node-server", experimental: { tasks: false, taskCLI: true } },
    { preset: "standard", experimental: { tasks: true, taskCLI: true } },
    { preset: "node-server", builder: false, experimental: { tasks: true, taskCLI: true } },
  ] as const)("rejects unsupported task CLI configuration %#", async (config) => {
    await expect(
      createNitro({ ...config, rootDir: resolve("test/task-cli/fixture") })
    ).rejects.toThrow(/experimental.taskCLI/);
  });
});
