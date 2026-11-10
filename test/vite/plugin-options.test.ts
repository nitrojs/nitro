import { fileURLToPath } from "node:url";
import { join } from "pathe";
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
          ...(userConfig.plugins || []),
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

  test("reads inline top-level `services` on a provided nitro instance", async () => {
    const provided = await createNitro({ rootDir });
    const { config, nitro } = await resolve({
      _nitro: provided,
      services: { other: { entry: "./api-entry" } },
    });
    expect(Object.keys(config.environments)).toEqual(expect.arrayContaining(["api", "other"]));
    // `vite.services` (alias) and server environments are registered in `services`
    expect(Object.keys(nitro.options.services).sort()).toEqual(["api", "other", "ssr"]);
    expect(nitro.options.services.other.entry).toBe(join(rootDir, "api-entry.ts"));
  });

  test("registers services added by nitro modules", async () => {
    const { config, nitro } = await resolve(
      {},
      {
        plugins: [
          {
            name: "add-services",
            nitro: {
              setup(n) {
                n.options.vite!.services = {
                  ...n.options.vite!.services,
                  alias: { entry: "./api-entry.ts" },
                  // Overrides \`vite.services.api\` of nitro.config
                  api: { entry: "./entry-server.ts" },
                };
                n.options.services.other = { entry: "./api-entry" };
              },
            },
          },
        ],
      }
    );
    expect(Object.keys(config.environments)).toEqual(
      expect.arrayContaining(["api", "alias", "other"])
    );
    expect(nitro.options.services.other.entry).toBe(join(rootDir, "api-entry.ts"));
    expect(nitro.options.services.api.entry).toBe(join(rootDir, "entry-server.ts"));
  });

  test("inline `vite.services` override `services` of the config", async () => {
    const inline = { vite: { services: { api: { entry: "./entry-server.ts" } } } };
    const { nitro } = await resolve(inline);
    expect(nitro.options.services.api.entry).toBe(join(rootDir, "entry-server.ts"));

    const provided = await createNitro({
      rootDir,
      services: { api: { entry: "./api-entry.ts" } },
    });
    const { nitro: nitro2 } = await resolve({ _nitro: provided, ...inline });
    expect(nitro2.options.services.api.entry).toBe(join(rootDir, "entry-server.ts"));
  });
});
