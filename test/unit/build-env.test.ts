import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it, vi } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";
import { legacyUnenvLayers, resolveUnenv } from "../../src/config/resolvers/unenv.ts";
import { resolveBuildEnv } from "../../src/build/env.ts";

const warn = vi.hoisted(() => vi.fn());
vi.mock("consola", () => ({ default: { warn } }));

const resolveAlias = vi.hoisted(() => vi.fn());
vi.mock("pathe/utils", async (importOriginal) => {
  const mod = await importOriginal<typeof import("pathe/utils")>();
  resolveAlias.mockImplementation(mod.resolveAlias);
  return { ...mod, resolveAlias };
});

function createOptions(options: Partial<NitroOptions> = {}): NitroOptions {
  return {
    rootDir: process.cwd() + "/",
    node: true,
    alias: {},
    inject: {},
    polyfills: [],
    builtinModules: [],
    unenv: [],
    ...options,
  } as NitroOptions;
}

describe("deprecated `unenv` option", () => {
  it("normalizes presets and warns once", async () => {
    const options = createOptions({ unenv: { external: ["a"] } as any });
    await resolveUnenv(options);
    await resolveUnenv(createOptions({ unenv: [{ external: ["b"] }] }));
    expect(options.unenv).toEqual([{ external: ["a"] }]);
    expect(options.alias).toEqual({});
    expect(options.builtinModules).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("converts presets to build env layers", () => {
    const [layer] = legacyUnenvLayers(
      createOptions({
        unenv: [
          {
            meta: { url: import.meta.url },
            alias: { "my-pathe": "pathe" },
            inject: { Buffer: "/legacy/buffer", process: false },
            polyfill: ["/legacy/polyfill"],
            external: ["legacy-external", "!node:fs"],
          },
        ],
      })
    );
    expect(layer!.alias!["my-pathe"]).toMatch(/node_modules\/pathe\/dist\/index\.mjs$/);
    expect(layer!.inject).toEqual({ Buffer: "/legacy/buffer", process: false });
    expect(layer!.polyfills).toEqual(["/legacy/polyfill"]);
    expect(layer!.builtinModules).toEqual(["legacy-external", "!node:fs"]);
  });
});

describe("resolveBuildEnv", () => {
  const createNitro = (options: Partial<NitroOptions>) =>
    ({ options: createOptions(options), logger: { warn } }) as unknown as Nitro;

  it("adds only common aliases for node builds", async () => {
    const env = await resolveBuildEnv(createNitro({ builtinModules: ["my-external"] }));
    expect(env.alias["buffer/"]).toBe("node:buffer");
    expect(env.alias["node:fs"]).toBeUndefined();
    expect(env.inject).toEqual({});
    expect(env.polyfills).toEqual([
      expect.stringMatching(/runtime\/internal\/polyfills\/fast-response\.(ts|mjs)$/),
    ]);
    expect(env.external).toEqual(["my-external"]);
    expect(env.alias.nitro).toBeUndefined();
  });

  it("respects `features.fastResponse`", async () => {
    const disabled = await resolveBuildEnv(createNitro({ features: { fastResponse: false } }));
    expect(disabled.polyfills).toEqual([]);
    const enabled = await resolveBuildEnv(
      createNitro({ node: false, features: { fastResponse: true } })
    );
    expect(enabled.polyfills.some((p) => p.includes("fast-response"))).toBe(true);
  });

  it("aliases `nitro` imports when the project cannot resolve it", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-env-"));
    try {
      const env = await resolveBuildEnv(createNitro({ rootDir }));
      expect(env.alias.nitro).toBe(join(process.cwd(), "dist/runtime/nitro.mjs"));
      expect(env.alias["nitro/h3"]).toBe(join(process.cwd(), "lib/h3.mjs"));
      expect(env.alias["nitro/package.json"]).toBe(join(process.cwd(), "package.json"));
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("adds node compatibility for `node: false` builds", async () => {
    const env = await resolveBuildEnv(createNitro({ node: false }));
    // `unenv` ids are resolved on demand by the bundler
    expect(env.alias["node:fs"]).toBe("unenv/node/fs");
    expect(env.alias.fs).toBe(env.alias["node:fs"]);
    expect(env.inject.Buffer).toEqual(["unenv/node/buffer", "Buffer"]);
    expect(env.inject.performance).toBe("unenv/polyfill/performance");
    expect(env.polyfills).toHaveLength(4);
    expect(env.polyfills).toEqual(
      env.polyfills.map(() => expect.stringMatching(/runtime\/internal\/polyfills\/\w+\.(ts|mjs)$/))
    );
  });

  it("lets options override, remove and negate defaults", async () => {
    const env = await resolveBuildEnv(
      createNitro({
        node: false,
        alias: { "node:fs": "node:fs", "my-pathe": "pathe" },
        inject: { performance: false },
        polyfills: ["!#nitro/runtime/polyfills/timers"],
        builtinModules: ["node:fs", "node:fs"],
      })
    );
    expect(env.alias["node:fs"]).toBe("node:fs");
    expect(env.alias["my-pathe"]).toMatch(/node_modules\/pathe\/dist\/index\.mjs$/);
    expect(env.inject.performance).toBeUndefined();
    expect(env.polyfills).toHaveLength(3);
    expect(env.polyfills.some((p) => p.includes("timers"))).toBe(false);
    expect(env.external).toEqual(["node:fs"]);
  });

  it("resolves relative ids from `rootDir`", async () => {
    const env = await resolveBuildEnv(
      createNitro({
        features: { fastResponse: false },
        polyfills: ["./src/build/env.ts", "./does-not-exist.ts"],
      })
    );
    expect(env.polyfills).toEqual([`${process.cwd()}/src/build/env.ts`, "./does-not-exist.ts"]);
  });

  it("applies legacy presets pushed to `nitro.options.unenv` from hooks", async () => {
    const nitro = createNitro({});
    nitro.options.unenv.push({ external: ["late-external"] });
    const env = await resolveBuildEnv(nitro);
    expect(env.external).toEqual(["late-external"]);
    expect(await resolveBuildEnv(nitro)).toEqual(env);
  });

  it("normalizes the alias map once", async () => {
    resolveAlias.mockClear();
    await resolveBuildEnv(createNitro({ node: false }));
    const maps = new Set(resolveAlias.mock.calls.map(([, aliases]) => aliases));
    expect(resolveAlias.mock.calls.length).toBeGreaterThan(1);
    expect(maps.size).toBe(1);
    const [aliases] = maps;
    expect(aliases[Symbol.for("pathe:normalizedAlias")]).toBe(true);
  });
});
