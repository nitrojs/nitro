import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Plugin } from "rollup";
import type { NitroConfig } from "nitropack/types";
import { createNitro } from "../../src/core/nitro";
import { getRollupConfig } from "../../src/rollup/config";

const SOURCE = `export const load = () => import("pkg/data.json", { with: { type: "json" } });\n`;

const rollupConfig = async (config?: NitroConfig) => {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-import-attributes-"));
  const nitro = await createNitro({
    rootDir,
    compatibilityDate: "latest",
    ...config,
  });
  return getRollupConfig(nitro);
};

// Rollup 4 defaults to `assert`, which Node.js removed in v22.
describe("import attributes", () => {
  it("emits external imports with the `with` key", async () => {
    const { output } = await rollupConfig();
    expect(
      (output as { importAttributesKey?: string }).importAttributesKey
    ).toBe("with");
  });

  it("keeps an explicit key from user config", async () => {
    const { output } = await rollupConfig({
      rollupConfig: { output: { importAttributesKey: "assert" } },
    });
    expect(
      (output as { importAttributesKey?: string }).importAttributesKey
    ).toBe("assert");
  });

  it("survives the esbuild transform of a .ts source", async () => {
    const { plugins } = await rollupConfig();
    const esbuildPlugin = (plugins as Plugin[]).find(
      (plugin) => plugin?.name === "esbuild"
    );
    const transform = esbuildPlugin?.transform as unknown as (
      this: { warn: () => void },
      code: string,
      id: string
    ) => Promise<{ code: string } | undefined>;
    const transformed = await transform.call(
      { warn: () => {} },
      SOURCE,
      "/src/entry.ts"
    );
    expect(transformed?.code).toContain(`with: { type: "json" }`);
  });
});
