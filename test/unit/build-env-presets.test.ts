import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import type { Nitro, NitroConfig } from "nitro/types";
import { createNitro } from "../../src/builder.ts";
import { resolveBuildEnv } from "../../src/build/env.ts";

const rootDir = fileURLToPath(new URL("../fixture", import.meta.url));

async function setup(config: NitroConfig, setupNitro?: (nitro: Nitro) => void) {
  const nitro = await createNitro({
    rootDir,
    compatibilityDate: "2025-01-01",
    logLevel: 0,
    ...config,
  });
  setupNitro?.(nitro);
  await nitro.hooks.callHook("build:before", nitro);
  const env = await resolveBuildEnv(nitro);
  await nitro.close();
  return { nitro, env };
}

describe("build env precedence with presets", () => {
  it.each(["deno-deploy", "netlify-edge"])(
    "%s does not expose builtin aliases to path resolution",
    async (preset) => {
      const { nitro, env } = await setup({ preset, plugins: ["utils/plugin.ts", "events.ts"] });
      expect(nitro.options.plugins).toContain(`${rootDir}/utils/plugin.ts`);
      expect(nitro.options.plugins).toContain(`${rootDir}/events.ts`);
      expect(nitro.options.alias.events).toBeUndefined();
      expect(env.alias.events).toBe("node:events");
    }
  );

  it("legacy `unenv` config overrides preset entries", async () => {
    const { env } = await setup({
      preset: "deno-deploy",
      unenv: { alias: { "node:fs": "/legacy/fs" }, inject: { process: "/legacy/process" } },
    });
    expect(env.alias["node:fs"]).toBe("/legacy/fs");
    expect(env.inject.process).toBe("/legacy/process");
  });

  it("legacy presets pushed from hooks override preset entries", async () => {
    const { env } = await setup({ preset: "cloudflare-module" }, (nitro) => {
      nitro.hooks.hook("build:before", () => {
        nitro.options.unenv.push({
          alias: { "node:fs": "/hook/fs" },
          inject: { Buffer: "/hook/buffer" },
        });
      });
    });
    expect(env.alias["node:fs"]).toBe("/hook/fs");
    expect(env.inject.Buffer).toBe("/hook/buffer");
    expect(env.external).toContain("cloudflare:workers");
    expect(env.external).toContain("node:fs");
  });

  it("user options override preset and legacy entries", async () => {
    const { env } = await setup({
      preset: "cloudflare-module",
      alias: { "node:fs": "/user/fs" },
      inject: { Buffer: false },
      unenv: { alias: { "node:fs": "/legacy/fs" } },
    });
    expect(env.alias["node:fs"]).toBe("/user/fs");
    expect(env.inject.Buffer).toBeUndefined();
  });
});
