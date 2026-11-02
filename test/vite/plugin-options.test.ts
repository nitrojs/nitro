import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite";
import type { Nitro } from "nitro/types";
import { afterEach, describe, expect, test } from "vitest";
import { nitro } from "../../src/vite.ts";
import type { NitroPluginConfig } from "../../src/vite.ts";
import { createNitro } from "../../src/nitro.ts";

const { resolveConfig } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./plugin-options-fixture", import.meta.url));

describe("vite: plugin options", () => {
  const instances: Nitro[] = [];

  afterEach(async () => {
    await Promise.all(instances.splice(0).map((instance) => instance.close()));
  });

  async function resolve(pluginConfig: NitroPluginConfig = {}, userConfig: UserConfig = {}) {
    let nitroInstance: Nitro | undefined;
    const config = await resolveConfig(
      {
        root: rootDir,
        configFile: false,
        logLevel: "silent",
        ...userConfig,
        plugins: [
          nitro(pluginConfig),
          { name: "capture", nitro: { setup: (n) => void instances.push((nitroInstance = n)) } },
        ],
      },
      "build"
    );
    return { config, nitro: nitroInstance! };
  }

  test("reads `vite` options from nitro.config", async () => {
    const { config, nitro } = await resolve();
    expect(Object.keys(config.environments)).toEqual(
      expect.arrayContaining(["api", "ssr", "nitro"])
    );
    expect(nitro.options.vite?.assetsImport).toBe(false);
    // `?assets` support makes the ssr environment emit assets
    expect(config.environments.ssr.build.emitAssets).toBe(false);
  });

  test("inline plugin options override nitro.config", async () => {
    const { config } = await resolve({ vite: { assetsImport: true } });
    expect(config.environments.ssr.build.emitAssets).toBe(true);
  });

  test("reads `vite` options from the `nitro` key of the vite config", async () => {
    const { config, nitro } = await resolve(
      {},
      { nitro: { vite: { services: { other: { entry: "./api-entry.ts" } } } } }
    );
    expect(Object.keys(config.environments)).toEqual(expect.arrayContaining(["api", "other"]));
    expect(Object.keys(nitro.options.vite?.services || {}).sort()).toEqual(["api", "other"]);
  });

  test("reads inline `vite` options on a provided nitro instance", async () => {
    const provided = await createNitro({ rootDir });
    const { config, nitro } = await resolve({
      _nitro: provided,
      vite: { assetsImport: true, services: { other: { entry: "./api-entry.ts" } } },
    });
    expect(Object.keys(config.environments)).toEqual(
      expect.arrayContaining(["api", "other", "nitro"])
    );
    expect(nitro.options.vite?.assetsImport).toBe(true);
    expect(config.environments.ssr.build.emitAssets).toBe(true);
    expect(Object.keys(nitro.options.vite?.services || {}).sort()).toEqual(["api", "other"]);
  });
});
