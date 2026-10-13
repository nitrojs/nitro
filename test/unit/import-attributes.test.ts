import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { NitroConfig } from "nitro/types";
import { createNitro } from "../../src/nitro.ts";
import { getRollupConfig } from "../../src/build/rollup/config.ts";
import { getBundlerConfig } from "../../src/build/vite/bundler.ts";
import type { NitroPluginContext } from "../../src/build/vite/types.ts";

const nitroFor = (config?: NitroConfig) =>
  createNitro({
    rootDir: mkdtempSync(join(tmpdir(), "nitro-import-attributes-")),
    compatibilityDate: "latest",
    ...config,
  });

const viteRollupOutput = async (config?: NitroConfig) => {
  const nitro = await nitroFor(config);
  const { rollupConfig } = await getBundlerConfig({
    nitro,
    _isRolldown: false,
  } as unknown as NitroPluginContext);
  return rollupConfig!.output!;
};

// Rollup 4 defaults to `assert`, which Node.js removed in v22.
describe("import attributes", () => {
  it("emits external imports with the `with` key", async () => {
    const { output } = await getRollupConfig(await nitroFor());
    expect((output as { importAttributesKey?: string }).importAttributesKey).toBe("with");
  });

  it("uses the same key in the vite builder's rollup output", async () => {
    expect((await viteRollupOutput()).importAttributesKey).toBe("with");
  });

  it("keeps an explicit key from user config", async () => {
    const userConfig: NitroConfig = {
      rollupConfig: { output: { importAttributesKey: "assert" } },
    };
    const { output } = await getRollupConfig(await nitroFor(userConfig));
    expect((output as { importAttributesKey?: string }).importAttributesKey).toBe("assert");
    expect((await viteRollupOutput(userConfig)).importAttributesKey).toBe("assert");
  });
});
