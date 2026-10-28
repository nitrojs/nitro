import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createNitro } from "../../src/nitro.ts";
import { getRolldownConfig } from "../../src/build/rolldown/config.ts";

// Bun lists `bun:*` ids, and Node some ids only with their `node:` prefix (e.g. `node:sqlite`)
vi.mock("node:module", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:module")>();
  return { ...mod, builtinModules: [...mod.builtinModules, "bun:sqlite", "node:sqlite"] };
});

describe("rolldown builtins", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-rolldown-builtins-"));
  afterAll(() => rmSync(rootDir, { recursive: true, force: true }));

  it("externalizes prefixed builtins by their own id", async () => {
    const nitro = await createNitro({
      rootDir,
      preset: "node-server",
      compatibilityDate: "latest",
    });
    const external = (await getRolldownConfig(nitro)).external as string[];
    await nitro.close();
    expect(external).toEqual(
      expect.arrayContaining(["events", "node:events", "node:sqlite", "bun:sqlite"])
    );
    expect(external.filter((id) => /^node:[^/]*:/.test(id))).toEqual([]);
  });
});
