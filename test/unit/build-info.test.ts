import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { rolldown } from "rolldown";
import type { RollupOutput } from "rollup";
import type { Nitro } from "nitro/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeBuildInfo } from "../../src/build/info.ts";

describe("writeBuildInfo", () => {
  let rootDir: string;
  const fixtureDir = fileURLToPath(new URL("../fixture/build-info/", import.meta.url));

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-build-info-"));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  function createNitro(entry = join(rootDir, "server")) {
    return {
      options: {
        rootDir,
        entry,
        output: {
          dir: join(rootDir, ".output"),
          serverDir: join(rootDir, ".output/server"),
          publicDir: join(rootDir, ".output/public"),
        },
        commands: {},
      },
    } as Nitro;
  }

  async function buildInfoFor(entries: { fileName: string; facadeModuleId: string | null }[]) {
    const nitro = createNitro();
    const output = {
      output: entries.map((entry) => ({ type: "chunk", isEntry: true, ...entry })),
    } as unknown as RollupOutput;

    const info = await writeBuildInfo(nitro, output);
    const saved = JSON.parse(await readFile(join(rootDir, ".output/nitro.json"), "utf8"));
    expect(saved.serverEntry).toBe(info.serverEntry);
    return info;
  }

  it("records Nitro's entry when another entry chunk appears first", async () => {
    const info = await buildInfoFor([
      { fileName: "_chunks/app.mjs", facadeModuleId: join(rootDir, "app/app.ts") },
      { fileName: "index.mjs", facadeModuleId: join(rootDir, "server.ts") },
    ]);
    expect(info.serverEntry).toBe("server/index.mjs");
  });

  it("uses Nitro's entry even when the output name is customized", async () => {
    const info = await buildInfoFor([
      { fileName: "_chunks/app.mjs", facadeModuleId: join(rootDir, "app/app.ts") },
      { fileName: "worker.mjs", facadeModuleId: join(rootDir, "server.ts") },
    ]);
    expect(info.serverEntry).toBe("server/worker.mjs");
  });

  it("keeps the original fallback when facade IDs are unavailable", async () => {
    const info = await buildInfoFor([
      { fileName: "worker.mjs", facadeModuleId: null },
      { fileName: "index.mjs", facadeModuleId: null },
    ]);
    expect(info.serverEntry).toBe("server/worker.mjs");
  });

  it("selects Nitro's entry from real Rolldown output with another entry first", async () => {
    const exposedEntry = join(fixtureDir, "exposed.ts");
    const nitroEntry = join(fixtureDir, "server.ts");
    const build = await rolldown({ input: [exposedEntry, nitroEntry] });
    const output = await build.write({
      dir: join(rootDir, ".output/server"),
      entryFileNames: "[name].mjs",
    });
    await build.close();

    const entries = output.output.filter((item) => item.type === "chunk" && item.isEntry);
    expect(entries.map((item) => item.fileName)).toEqual(["exposed.mjs", "server.mjs"]);

    const info = await writeBuildInfo(createNitro(join(fixtureDir, "server")), output);
    expect(info.serverEntry).toBe("server/server.mjs");
  });
});
