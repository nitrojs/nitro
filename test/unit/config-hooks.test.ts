import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import { loadOptions } from "../../src/config/loader.ts";

const tempDirs: string[] = [];

declare global {
  var __nitroHookCalls: string[];
}

async function createFixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-config-hooks-"));
  tempDirs.push(rootDir);
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(rootDir, name), contents);
  }
  return rootDir;
}

async function callHook(hooks: Record<string, any>, ...path: string[]) {
  let hook: any = hooks;
  for (const key of path) {
    hook = hook?.[key];
  }
  await hook?.();
}

const presetFile = `export default {
  extends: "node-server",
  hooks: {
    compiled() { globalThis.__nitroHookCalls.push("preset:compiled") },
    "rollup:before"() { globalThis.__nitroHookCalls.push("preset:rollup:before") },
  },
}
`;

afterEach(async () => {
  globalThis.__nitroHookCalls = [];
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("config hooks", () => {
  it("runs both preset and user hooks with the same name", async () => {
    globalThis.__nitroHookCalls = [];
    const rootDir = await createFixture({
      "preset.mjs": presetFile,
      "nitro.config.mjs": `export default {
        preset: "./preset.mjs",
        hooks: {
          compiled() { globalThis.__nitroHookCalls.push("config:compiled") },
        },
      }`,
    });
    const options = await loadOptions({
      rootDir,
      hooks: {
        compiled() {
          globalThis.__nitroHookCalls.push("overrides:compiled");
        },
      },
    });

    await callHook(options.hooks, "compiled");
    expect(globalThis.__nitroHookCalls).toEqual([
      "preset:compiled",
      "config:compiled",
      "overrides:compiled",
    ]);
  });

  it("merges nested and flat hook names", async () => {
    globalThis.__nitroHookCalls = [];
    const rootDir = await createFixture({
      "preset.mjs": presetFile,
      "nitro.config.mjs": `export default {
        preset: "./preset.mjs",
        hooks: {
          rollup: { before() { globalThis.__nitroHookCalls.push("config:rollup:before") } },
        },
      }`,
    });
    const options = await loadOptions({ rootDir });

    await callHook(options.hooks, "rollup:before");
    expect(globalThis.__nitroHookCalls).toEqual(["preset:rollup:before", "config:rollup:before"]);
  });

  it("merges hooks from `$production` with base config hooks", async () => {
    globalThis.__nitroHookCalls = [];
    const rootDir = await createFixture({
      "nitro.config.mjs": `export default {
        preset: "node-server",
        hooks: {
          compiled() { globalThis.__nitroHookCalls.push("config:compiled") },
        },
        $production: {
          hooks: {
            compiled() { globalThis.__nitroHookCalls.push("production:compiled") },
          },
        },
      }`,
    });
    const options = await loadOptions({ rootDir });

    await callHook(options.hooks, "compiled");
    expect(globalThis.__nitroHookCalls).toEqual(["config:compiled", "production:compiled"]);
  });
});
