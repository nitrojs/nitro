import { describe, expect, it, vi } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";
import { resolveUnenv } from "../../src/config/resolvers/unenv.ts";
import { resolveBuildEnv } from "../../src/build/env.ts";

const warn = vi.hoisted(() => vi.fn());
vi.mock("consola", () => ({ default: { warn } }));

function createOptions(options: Partial<NitroOptions> = {}): NitroOptions {
  return {
    rootDir: process.cwd() + "/",
    node: true,
    alias: {},
    inject: {},
    polyfills: [],
    external: [],
    ...options,
  } as NitroOptions;
}

describe("resolveUnenv (deprecated `unenv` option)", () => {
  it("merges presets into `alias`, `inject`, `polyfills` and `external`", async () => {
    warn.mockClear();
    const options = createOptions({
      alias: { shared: "/user/shared" },
      inject: { Buffer: ["node:buffer", "Buffer"] },
      unenv: [
        {
          alias: { foo: "/legacy/foo", shared: "/legacy/shared" },
          inject: { Buffer: "/legacy/buffer", process: false },
          polyfill: ["/legacy/polyfill"],
          external: ["legacy-external", "!node:fs"],
        },
      ],
    });
    await resolveUnenv(options);

    expect(warn).toHaveBeenCalledOnce();
    expect(options.unenv).toEqual([]);
    expect(options.alias).toEqual({ foo: "/legacy/foo", shared: "/user/shared" });
    expect(options.inject).toEqual({ Buffer: ["node:buffer", "Buffer"], process: false });
    expect(options.polyfills).toEqual(["/legacy/polyfill"]);
    expect(options.external).toEqual(["legacy-external", "!node:fs"]);
  });

  it("accepts a single preset and resolves ids from `meta.url`", async () => {
    const options = createOptions({
      unenv: { meta: { url: import.meta.url }, alias: { "my-pathe": "pathe" } } as any,
    });
    await resolveUnenv(options);
    expect(options.alias["my-pathe"]).toMatch(/node_modules\/pathe\/dist\/index\.mjs$/);
  });

  it("does not warn without legacy presets", async () => {
    warn.mockClear();
    await resolveUnenv(createOptions({ unenv: [] }));
    await resolveUnenv(createOptions());
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("resolveBuildEnv", () => {
  const createNitro = (options: Partial<NitroOptions>) =>
    ({ options: createOptions(options) }) as Nitro;

  it("adds only common aliases for node builds", async () => {
    const env = await resolveBuildEnv(createNitro({ external: ["my-external"] }));
    expect(env.alias["buffer/"]).toBe("node:buffer");
    expect(env.alias["node:fs"]).toBeUndefined();
    expect(env.inject).toEqual({});
    expect(env.polyfills).toEqual([]);
    expect(env.external).toEqual(["my-external"]);
  });

  it("adds node compatibility for `node: false` builds", async () => {
    const env = await resolveBuildEnv(createNitro({ node: false }));
    expect(env.alias["node:fs"]).toMatch(/unenv\/dist\/runtime\/node\/fs\.mjs$/);
    expect(env.alias.fs).toBe(env.alias["node:fs"]);
    expect(env.inject.Buffer).toEqual([env.alias["node:buffer"], "Buffer"]);
    expect(env.polyfills).toHaveLength(4);
  });

  it("lets options override, remove and negate defaults", async () => {
    const env = await resolveBuildEnv(
      createNitro({
        node: false,
        alias: { "node:fs": "node:fs", "my-pathe": "pathe" },
        inject: { performance: false },
        polyfills: ["!unenv/polyfill/timers"],
        external: ["node:fs", "node:fs"],
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
      createNitro({ polyfills: ["./src/build/env.ts", "./does-not-exist.ts"] })
    );
    expect(env.polyfills).toEqual([`${process.cwd()}/src/build/env.ts`, "./does-not-exist.ts"]);
  });

  it("applies legacy presets pushed to `nitro.options.unenv` from hooks", async () => {
    warn.mockClear();
    const nitro = createNitro({ unenv: [] });
    nitro.options.unenv.push({ external: ["late-external"] });
    const env = await resolveBuildEnv(nitro);
    expect(env.external).toEqual(["late-external"]);
    expect(nitro.options.unenv).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
