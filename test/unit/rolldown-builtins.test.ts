import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createNitro } from "../../src/nitro.ts";
import { getRolldownConfig } from "../../src/build/rolldown/config.ts";

// Bun lists `bun:*` ids, and Node some ids only with their `node:` prefix (e.g. `node:sqlite`)
vi.mock("node:module", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:module")>();
  return { ...mod, builtinModules: [...mod.builtinModules, "bun:sqlite", "node:sqlite"] };
});

describe("rolldown builtins", () => {
  it("externalizes prefixed builtins by their own id", async () => {
    const nitro = await createNitro({
      rootDir: mkdtempSync(join(tmpdir(), "nitro-rolldown-builtins-")),
      compatibilityDate: "latest",
    });
    const external = (await getRolldownConfig(nitro)).external as string[];
    expect(external).toEqual(
      expect.arrayContaining(["events", "node:events", "node:sqlite", "bun:sqlite"])
    );
    expect(external.filter((id) => /^node:[^/]*:/.test(id))).toEqual([]);
  });
});
