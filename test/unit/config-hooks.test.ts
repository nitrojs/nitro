import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadOptions } from "../../src/config/loader.ts";
import { createNitro } from "../../src/nitro.ts";

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
    "build:config"() { globalThis.__nitroHookCalls.push("preset:build:config") },
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
          build: { config() { globalThis.__nitroHookCalls.push("config:build:config") } },
        },
      }`,
    });
    const options = await loadOptions({ rootDir });

    await callHook(options.hooks, "build:config");
    expect(globalThis.__nitroHookCalls).toEqual(["preset:build:config", "config:build:config"]);
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

describe("deprecated hooks", () => {
  it("calls `rollup:before` and `rollup:reload` hooks from `build:config` and `build:reload`", async () => {
    const rootDir = await createFixture({});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const calls: unknown[] = [];
    const nitro = await createNitro({
      rootDir,
      hooks: {
        rollup: {
          before: (_nitro, config) => {
            calls.push(["config:rollup:before", config]);
          },
        },
      },
    });
    const loggerWarn = vi.spyOn(nitro.logger, "warn").mockImplementation(() => {});
    nitro.hooks.hook("rollup:before", (_nitro, config) => {
      calls.push(["rollup:before", config]);
    });
    nitro.hooks.hook("rollup:reload", () => {
      calls.push("rollup:reload");
    });

    const rolldown = { input: "entry" };
    await nitro.hooks.callHook("build:config", nitro, { builder: "rolldown", rolldown });
    await nitro.updateConfig({});
    expect(calls).toEqual([
      ["config:rollup:before", rolldown],
      ["rollup:before", rolldown],
      "rollup:reload",
    ]);
    expect(calls[0]).toContain(rolldown);
    expect(loggerWarn).toHaveBeenCalledOnce();
    expect(loggerWarn).toHaveBeenCalledWith(expect.stringContaining("Use `build:config` instead"));
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("please use build:reload"));

    consoleWarn.mockRestore();
    await nitro.close();
  });
});
