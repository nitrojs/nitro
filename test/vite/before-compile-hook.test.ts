import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { readFile, rm, writeFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { build, createNitro, prepare } from "nitro/builder";

// #4428: modules need a point to emit files into the public output dir that is late
// enough to be after `copyPublicAssets()` and prerendering, but still early enough for
// the emitted files to end up in the server bundle's public asset list.
const fixtureDir = fileURLToPath(new URL("./before-compile-hook-fixture", import.meta.url));
const outDir = join(fixtureDir, ".tmp");

describe("vite: vite:before:compile hook", () => {
  const calls: string[] = [];
  let serverEntry: string;

  beforeAll(async () => {
    await rm(outDir, { recursive: true, force: true });
    const nitro = await createNitro({
      rootDir: fixtureDir,
      output: { dir: outDir },
      builder: "vite",
      hooks: {
        "vite:before:compile": async (nitro) => {
          calls.push("vite:before:compile");
          await writeFile(
            join(nitro.options.output.publicDir, "emitted-by-hook.txt"),
            "emitted",
            "utf8"
          );
        },
        compiled: (nitro) => {
          calls.push("compiled");
          serverEntry = join(nitro.options.output.serverDir, "index.mjs");
        },
      },
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
  }, 60_000);

  it("runs before the server bundle is compiled", () => {
    expect(calls).toEqual(["vite:before:compile", "compiled"]);
  });

  it("assets emitted from the hook are picked up as public assets", async () => {
    expect(await readFile(serverEntry, "utf8")).toContain("emitted-by-hook.txt");
  });
});
