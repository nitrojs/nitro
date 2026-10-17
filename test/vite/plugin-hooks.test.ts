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
            rollup: {
              before: () => {
                calls.push("config:rollup:before");
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
              "rollup:before": () => {
                calls.push("plugin:rollup:before");
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

    // `rollup:before` already runs while resolving the bundler config
    calls.splice(0);
    await instance!.hooks.callHook("compiled", instance!);
    await instance!.hooks.callHook("rollup:before", instance!, {} as any);
    expect(calls).toEqual([
      "config:compiled",
      "plugin:compiled",
      "config:rollup:before",
      "plugin:rollup:before",
    ]);
  });
});
