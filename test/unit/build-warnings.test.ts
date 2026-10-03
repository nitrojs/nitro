import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createNitro } from "../../src/nitro.ts";
import { getRolldownConfig } from "../../src/build/rolldown/config.ts";
import { getRollupConfig } from "../../src/build/rollup/config.ts";
import { getBundlerConfig } from "../../src/build/vite/bundler.ts";
import type { NitroPluginContext } from "../../src/build/vite/types.ts";

type Warning = { code?: string; message: string };
type OnWarn = (warning: Warning, warn: (warning: Warning) => void) => void;

const nitroFor = () =>
  createNitro({
    rootDir: mkdtempSync(join(tmpdir(), "nitro-build-warnings-")),
    compatibilityDate: "latest",
  });

const viteOnWarn = async (_isRolldown: boolean) => {
  const { rollupConfig, rolldownConfig } = await getBundlerConfig({
    nitro: await nitroFor(),
    _isRolldown,
  } as unknown as NitroPluginContext);
  return (_isRolldown ? rolldownConfig : rollupConfig)!.onwarn as OnWarn;
};

const builders: [string, () => Promise<OnWarn>][] = [
  ["rollup", async () => (await getRollupConfig(await nitroFor())).onwarn as OnWarn],
  ["rolldown", async () => (await getRolldownConfig(await nitroFor())).onwarn as OnWarn],
  ["vite with rollup", () => viteOnWarn(false)],
  ["vite with rolldown", () => viteOnWarn(true)],
];

describe.each(builders)("%s build warnings", (_name, getOnWarn) => {
  // Server bundles are not React Server Components bundles, so a dependency's
  // `"use client"` directive has nothing to preserve.
  it('drops the "use client" directive warning', async () => {
    const warn = vi.fn();
    (await getOnWarn())(
      {
        code: "MODULE_LEVEL_DIRECTIVE",
        message:
          'The semantics of the module level directive "use client" in "node_modules/@tanstack/react-query/build/modern/useBaseQuery.js" may not be preserved when bundling.',
      },
      warn
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("forwards other warnings", async () => {
    const warn = vi.fn();
    const warning = { code: "UNRESOLVED_IMPORT", message: "Could not resolve 'missing'" };
    (await getOnWarn())(warning, warn);
    expect(warn).toHaveBeenCalledWith(warning);
  });
});
