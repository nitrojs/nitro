import type { EnvRunner } from "env-runner";
import type { Nitro } from "nitro/types";
import { loadRunner } from "env-runner";
import { pkgDir } from "#nitro/meta";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createNitro } from "../../src/nitro.ts";
import { scanHandlers } from "../../src/scan.ts";
import { prepareUnbundledApp } from "../../src/build/unbundled/entry.ts";
import { unbundledPlugins } from "../../src/build/unbundled/plugins.ts";

const missingDeps = new Set<string>();

vi.mock(import("../../src/utils/dep.ts"), async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    resolveDep: (id, opts) => (missingDeps.has(id) ? undefined : mod.resolveDep(id, opts)),
  };
});

const rootDir = fileURLToPath(new URL("fixture", import.meta.url));

// The self runner runs the plugins in synchronous loader hooks of this process
describe("builder: false (self runner)", () => {
  let nitro: Nitro;
  let runner: EnvRunner;

  beforeAll(async () => {
    nitro = await createNitro({ rootDir, preset: "nitro-serve", builder: false });
    await scanHandlers(nitro);
    nitro.routing.sync();
    const { entry, virtual } = await prepareUnbundledApp(nitro);
    runner = await loadRunner("self", {
      name: "nitro-self-test",
      data: { entry, virtual },
      plugins: await unbundledPlugins(nitro, { sync: true }),
    });
    await runner.waitForReady();
  });

  afterAll(async () => {
    await runner?.close();
    await nitro?.close();
  });

  const fetchJSON = (path: string) =>
    runner.fetch(new Request(`http://localhost${path}`)).then((res) => res.json());

  it("runs TypeScript sources and virtual modules", async () => {
    const res = await runner.fetch(new Request("http://localhost/"));
    expect(await res.text()).toBe("Hello, nitro!");
    expect(await fetchJSON("/api/42")).toEqual({ id: "42", hasRuntimeConfig: true });
  });

  it("applies synchronous `buildPlugins`", async () => {
    expect(await fetchJSON("/build-plugins")).toMatchObject({
      message: "Hello from build plugin!",
      transform: "transformed",
    });
  });

  it("applies build transforms (TypeScript, import.meta, alias, text and wasm imports)", async () => {
    expect(await fetchJSON("/features")).toEqual({
      dev: false,
      enum: "green",
      requestURL: "/features",
      text: "text asset",
      wasm: 5,
    });
  });
});

describe("unbundled plugins (sync)", () => {
  it("fails to resolve missing optional runtime dependencies instead of installing them", async () => {
    const nitro = await createNitro({ rootDir });
    const plugin = (await unbundledPlugins(nitro, { sync: true })).find(
      (p) => p.name === "nitro:runtime-deps"
    );
    const { handler } = plugin!.resolveId as { handler: (...args: any[]) => unknown };
    const resolve = vi.fn(() => ({ id: "/resolved", external: false }));
    const importer = join(pkgDir, "dist/runtime/internal/kv.mjs");

    // Installed: resolved synchronously
    expect(handler.call({ resolve }, "unstorage", importer)).toEqual({
      id: "/resolved",
      external: false,
    });

    missingDeps.add("db0");
    try {
      expect(() => handler.call({ resolve }, "db0", importer)).toThrow("`db0` is not installed.");
    } finally {
      missingDeps.delete("db0");
    }
    await nitro.close();
  });
});
