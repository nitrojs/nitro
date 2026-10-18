import { fileURLToPath } from "node:url";
import type { Nitro } from "nitro/types";
import { afterEach, describe, expect, test } from "vitest";
import { nitro } from "../../src/vite.ts";

const { resolveConfig } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./app-fixture", import.meta.url));

// #1382: hooks with the same name from `nitro()` options and the `nitro` key of the Vite config
// must both run instead of overriding each other.
describe("vite: plugin and user config hooks", () => {
  let instance: Nitro | undefined;

  afterEach(async () => {
    await instance?.close();
    instance = undefined;
  });

  test("runs hooks with the same name from plugin options and user config", async () => {
    const calls: string[] = [];
    await resolveConfig(
      {
        root: rootDir,
        configFile: false,
        nitro: {
          hooks: {
            compiled: () => {
              calls.push("config:compiled");
            },
            build: {
              config: () => {
                calls.push("config:build:config");
              },
            },
          },
        },
        plugins: [
          nitro({
            serverDir: "./",
            hooks: {
              compiled: () => {
                calls.push("plugin:compiled");
              },
              "build:config": () => {
                calls.push("plugin:build:config");
              },
            },
          }),
          {
            name: "capture-nitro",
            nitro: {
              setup(nitro) {
                instance = nitro;
              },
            },
          },
        ],
      },
      "build"
    );

    // `build:config` already runs while resolving the bundler config
    calls.splice(0);
    await instance!.hooks.callHook("compiled", instance!);
    await instance!.hooks.callHook("build:config", instance!, { builder: "vite", rolldown: {} });
    expect(calls).toEqual([
      "config:compiled",
      "plugin:compiled",
      "config:build:config",
      "plugin:build:config",
    ]);
  });
});
