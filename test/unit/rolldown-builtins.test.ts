import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import { rolldown } from "rolldown";
import { createNitro } from "../../src/nitro.ts";
import { getRolldownConfig } from "../../src/build/rolldown/config.ts";
import { builtinExternals } from "../../src/build/plugins/builtins.ts";

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

describe("nitro:builtins", () => {
  const dir = mkdtempSync(join(tmpdir(), "nitro-builtins-plugin-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("turns `require()` of native builtins into imports without the node platform", async () => {
    writeFileSync(
      join(dir, "lib.cjs"),
      [
        `module.exports = [require("events"), require("node:assert")];`,
        `try { require("node:sea"); } catch {}`,
      ].join("\n")
    );
    writeFileSync(join(dir, "entry.mjs"), `import lib from "./lib.cjs"; export default lib;`);
    const env = { alias: { events: "node:events" }, external: ["node:events", "node:assert"] };
    const bundle = await rolldown({
      input: join(dir, "entry.mjs"),
      platform: "neutral",
      // A user `external` does not bypass it
      external: ["node:assert"],
      plugins: [builtinExternals(env, { node: false })],
    });
    const { output } = await bundle.generate({ format: "esm" });
    const code = output[0].code;
    expect(code).toMatch(/import \* as [\w$]+ from "node:events"/);
    expect(code).toMatch(/import \* as [\w$]+ from "node:assert"/);
    expect(code).not.toMatch(/__require\("(?:events|node:events|node:assert)"\)/);
    // Not provided by the runtime: kept as a runtime call that only fails when reached
    expect(code).toContain(`__require("node:sea")`);
  });
});
