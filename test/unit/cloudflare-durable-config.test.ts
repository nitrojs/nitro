import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { createNitro } from "nitro/builder";
import { unstable_readConfig } from "wrangler";
import type { CloudflareOptions } from "../../src/presets/cloudflare/types.ts";
import { describe, expect, it } from "vitest";
import { writeWranglerConfig } from "../../src/presets/cloudflare/utils.ts";

async function generateConfig(
  cloudflare: CloudflareOptions = {},
  options: { preset?: string; derived?: boolean; env?: string } = {}
) {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-durable-config-"));
  const nitro = await createNitro({
    rootDir,
    preset: options.derived ? undefined : options.preset || "cloudflare-durable",
    defaultPreset: options.derived ? { extends: "cloudflare-durable" } : undefined,
    cloudflare: { deployConfig: true, ...cloudflare },
    compatibilityDate: "2026-09-01",
  });
  try {
    await nitro.hooks.callHook("build:before", nitro);
    await writeWranglerConfig(nitro, "module");
    if (options.env) {
      return unstable_readConfig({
        config: join(nitro.options.output.serverDir, "wrangler.json"),
        env: options.env,
      });
    }
    return JSON.parse(
      await readFile(join(nitro.options.output.serverDir, "wrangler.json"), "utf8")
    );
  } finally {
    await nitro.close();
    await rm(rootDir, { recursive: true, force: true });
  }
}

describe("cloudflare durable deployment config", () => {
  it("generates a default binding and initial SQLite migration", async () => {
    const config = await generateConfig();
    expect(config.durable_objects.bindings).toEqual([
      { name: "$DurableObject", class_name: "$DurableObject" },
    ]);
    expect(config.migrations).toEqual([{ tag: "v1", new_sqlite_classes: ["$DurableObject"] }]);
  });

  it("preserves an existing binding and migration history", async () => {
    const wrangler = {
      durable_objects: { bindings: [{ name: "CustomDO", class_name: "$DurableObject" }] },
      migrations: [{ tag: "original", new_classes: ["$DurableObject"] }],
    };
    const config = await generateConfig({ durable: { bindingName: "CustomDO" }, wrangler });
    expect(config.durable_objects).toEqual(wrangler.durable_objects);
    expect(config.migrations).toEqual(wrangler.migrations);
  });

  it("rejects a conflicting binding name", async () => {
    await expect(
      generateConfig({
        wrangler: {
          durable_objects: { bindings: [{ name: "$DurableObject", class_name: "OtherObject" }] },
        },
      })
    ).rejects.toThrow(/binding.*\$DurableObject/i);
  });

  it("rejects a remote binding with the configured name", async () => {
    await expect(
      generateConfig({
        wrangler: {
          durable_objects: {
            bindings: [
              { name: "$DurableObject", class_name: "$DurableObject", script_name: "other-worker" },
            ],
          },
        },
      })
    ).rejects.toThrow(/binding.*\$DurableObject/i);
  });

  it("leaves validation of an existing migration history to Wrangler", async () => {
    const migrations = [{ tag: "v1", new_sqlite_classes: ["OtherObject"] }];
    const config = await generateConfig({ wrangler: { migrations } });
    expect(config.migrations).toEqual(migrations);
  });

  it("does not configure durable objects on the module preset", async () => {
    const config = await generateConfig({}, { preset: "cloudflare-module" });
    expect(config.durable_objects).toBeUndefined();
    expect(config.migrations).toBeUndefined();
  });
  it("preserves deletion entries in existing migration histories", async () => {
    const migrations = [
      { tag: "v1", new_sqlite_classes: ["$DurableObject"] },
      { tag: "v2", deleted_classes: ["$DurableObject"] },
    ];
    const config = await generateConfig({ wrangler: { migrations } });
    expect(config.migrations).toEqual(migrations);
  });

  it("preserves a class introduced by a rename", async () => {
    const migrations = [
      { tag: "v1", new_sqlite_classes: ["OriginalObject"] },
      { tag: "v2", renamed_classes: [{ from: "OriginalObject", to: "$DurableObject" }] },
    ];
    const config = await generateConfig({ wrangler: { migrations } });
    expect(config.migrations).toEqual(migrations);
  });
  it("preserves declarative Durable Object exports without adding migrations", async () => {
    const exports = { $DurableObject: { type: "durable-object", storage: "sqlite" } } as const;
    const config = await generateConfig({ wrangler: { exports } });
    expect(config.exports).toEqual(exports);
    expect(config.migrations).toBeUndefined();
  });

  it("preserves a migration that transfers the class from another Worker", async () => {
    const migrations = [
      {
        tag: "v1",
        transferred_classes: [
          { from: "OldObject", from_script: "old-worker", to: "$DurableObject" },
        ],
      },
    ];
    const config = await generateConfig({ wrangler: { migrations } });
    expect(config.migrations).toEqual(migrations);
  });

  it("generates bindings in named environments without dropping existing ones", async () => {
    const config = await generateConfig(
      {
        durable: { bindingName: "CustomDO" },
        wrangler: {
          env: {
            production: {
              name: "nitro-production",
              durable_objects: {
                bindings: [
                  { name: "OtherDO", class_name: "OtherObject", script_name: "other-worker" },
                ],
              },
            },
          },
        },
      },
      { env: "production" }
    );
    expect(config.durable_objects.bindings).toEqual([
      { name: "OtherDO", class_name: "OtherObject", script_name: "other-worker" },
      { name: "CustomDO", class_name: "$DurableObject" },
    ]);
  });

  it("preserves environment exports without inheriting generated migrations", async () => {
    const exports = { $DurableObject: { type: "durable-object", storage: "sqlite" } } as const;
    const config = await generateConfig(
      { wrangler: { env: { production: { name: "nitro-production", exports } } } },
      { env: "production" }
    );
    expect(config.exports).toEqual(exports);
    expect(config.migrations).toEqual([]);
    expect(config.durable_objects.bindings).toEqual([
      { name: "$DurableObject", class_name: "$DurableObject" },
    ]);
  });

  it("generates bindings and migrations for an inherited durable preset", async () => {
    const config = await generateConfig(
      { durable: { bindingName: "CustomDO" } },
      { derived: true }
    );
    expect(config.durable_objects?.bindings).toEqual([
      { name: "CustomDO", class_name: "$DurableObject" },
    ]);
    expect(config.migrations).toEqual([{ tag: "v1", new_sqlite_classes: ["$DurableObject"] }]);
  });
});
