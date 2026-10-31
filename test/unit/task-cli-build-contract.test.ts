import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { buildFixture, cleanupFixtures } from "../task-cli/_build.ts";
import { stopChildren } from "../task-cli/_run.ts";

describe("task CLI build contract guards", () => {
  afterAll(async () => {
    await stopChildren();
    await cleanupFixtures();
  });

  it("rejects outputOptions renaming the reserved sidecar entry", async () => {
    await expect(buildFixture({ renameSidecar: true })).rejects.toThrow(
      /reserved task CLI output contract/
    );
  }, 60_000);

  it.each([
    ["rollup", false],
    ["rolldown", false],
    ["vite", true],
    ["vite", false],
  ] as const)(
    "rejects %s input replacement (Vite7=%s) before publishing metadata",
    async (builder, vite7) => {
      let output = "";
      await expect(
        buildFixture({
          builder,
          vite7,
          replaceSidecarInput: true,
          beforeBuild: async (dir) => {
            output = dir;
          },
        })
      ).rejects.toThrow(
        /reserved task CLI input contract|did not emit its reserved index.mjs entry/
      );
      expect(output).not.toBe("");
      const metadata = join(output, "nitro.json");
      if (existsSync(metadata))
        expect(JSON.parse(await readFile(metadata, "utf8")).taskEntry).toBeUndefined();
    },
    60_000
  );

  it("rejects a hook wrapping a Nitro plugin whose identity is needed for isolation", async () => {
    await expect(buildFixture({ wrapNitroPlugin: true })).rejects.toThrow(
      /replaced or wrapped Nitro build plugin/
    );
  }, 60_000);
});
