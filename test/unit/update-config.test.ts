import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import type { Nitro, NitroConfig } from "nitro/types";
import { createNitro } from "../../src/nitro.ts";

const instances: { nitro: Nitro; rootDir: string }[] = [];

async function setup(config: NitroConfig = {}) {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-update-config-"));
  const nitro = await createNitro({
    rootDir,
    publicAssets: [{ baseURL: "build", dir: "public/build", maxAge: 3600 }],
    ...config,
  });
  instances.push({ nitro, rootDir });
  return nitro;
}

const immutable = { "cache-control": "public, max-age=3600, immutable" };

afterEach(async () => {
  for (const { nitro, rootDir } of instances.splice(0)) {
    await nitro.close();
    await rm(rootDir, { recursive: true, force: true });
  }
});

describe("nitro.updateConfig", () => {
  it("keeps the route rules inferred from public assets", async () => {
    const nitro = await setup();
    expect(nitro.options.routeRules["/build/**"]).toMatchObject({ headers: immutable });

    await nitro.updateConfig({ routeRules: { "/foo": { headers: { "x-foo": "1" } } } });
    expect(nitro.options.routeRules["/foo"]).toMatchObject({ headers: { "x-foo": "1" } });
    expect(nitro.options.routeRules["/build/**"]).toMatchObject({ headers: immutable });
    expect(nitro.options.runtimeConfig.nitro?.routeRules?.["/build/**"]).toMatchObject({
      headers: immutable,
    });
  });

  it("merges the inferred rule under a user rule for the same route", async () => {
    const nitro = await setup();
    await nitro.updateConfig({ routeRules: { "/build/**": { headers: { "x-build": "1" } } } });
    expect(nitro.options.routeRules["/build/**"]).toMatchObject({
      headers: { ...immutable, "x-build": "1" },
    });

    await nitro.updateConfig({
      routeRules: { "/build/**": { headers: { "cache-control": "no-cache" } } },
    });
    expect(nitro.options.routeRules["/build/**"]).toMatchObject({
      headers: { "cache-control": "no-cache" },
    });
  });

  it("does not change public assets `maxAge` from updated rules", async () => {
    const nitro = await setup();
    await nitro.updateConfig({ routeRules: { "/build/**": { cache: { maxAge: 0 } } } });
    await nitro.updateConfig({ routeRules: {} });
    expect(nitro.options.publicAssets[0].maxAge).toBe(3600);
    expect(nitro.options.routeRules["/build/**"]).toMatchObject({ headers: immutable });
  });

  it("is idempotent, including when updated with the resolved rules", async () => {
    const userRules = { "/foo": { headers: { "x-foo": "1" } } };
    const nitro = await setup({ routeRules: structuredClone(userRules) });
    const initial = structuredClone(nitro.options.routeRules);

    for (let i = 0; i < 2; i++) {
      await nitro.updateConfig({ routeRules: structuredClone(userRules) });
      expect(nitro.options.routeRules).toEqual(initial);
    }

    await nitro.updateConfig({ routeRules: { ...nitro.options.routeRules } });
    expect(nitro.options.routeRules).toEqual(initial);

    const page = { "/page": { headers: { "x-page": "1" } } };
    await nitro.updateConfig({ routeRules: { ...nitro.options.routeRules, ...page } });
    await nitro.updateConfig({ routeRules: { ...nitro.options.routeRules, ...page } });
    expect(nitro.options.routeRules).toEqual({ ...initial, ...page });
  });

  it("keeps the derived runtime config keys when updating `runtimeConfig`", async () => {
    const nitro = await setup({
      baseURL: "/base/",
      experimental: { envExpansion: true },
      routeRules: { "/foo": { headers: { "x-foo": "1" } } },
      runtimeConfig: { foo: "bar" },
    });
    const initial = structuredClone(nitro.options.runtimeConfig);

    await nitro.updateConfig({ runtimeConfig: { foo: "baz" } });
    expect(nitro.options.runtimeConfig).toEqual({ ...initial, foo: "baz" });

    await nitro.updateConfig({
      routeRules: { "/foo": { headers: { "x-foo": "2" } } },
      runtimeConfig: { foo: "bar" },
    });
    expect(nitro.options.runtimeConfig.foo).toBe("bar");
    expect(nitro.options.runtimeConfig.nitro?.routeRules).toEqual(nitro.options.routeRules);
    expect(nitro.options.routeRules["/build/**"]).toMatchObject({ headers: immutable });

    await nitro.updateConfig({ routeRules: {} });
    expect(nitro.options.runtimeConfig.foo).toBe("bar");
    expect(nitro.options.runtimeConfig.app.baseURL).toBe("/base/");
  });

  it("resolves after the `build:reload` hook", async () => {
    const nitro = await setup();
    let reloaded = false;
    nitro.hooks.hook("build:reload", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      reloaded = true;
    });
    await nitro.updateConfig({});
    expect(reloaded).toBe(true);
  });
});
