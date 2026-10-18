import type { NitroOptions } from "nitro/types";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rolldown: undefined as string | undefined, vite: false }));

vi.mock("../../src/build/rolldown/_import.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/build/rolldown/_import.ts")>()),
  resolveRolldown: () => state.rolldown,
}));

vi.mock("../../src/utils/dep.ts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../src/utils/dep.ts")>();
  return {
    ...mod,
    isDepInstalled: (id: string, opts: Parameters<typeof mod.isDepInstalled>[1]) =>
      id === "vite" ? state.vite : mod.isDepInstalled(id, opts),
  };
});

const { resolveBuilder } = await import("../../src/config/resolvers/builder.ts");

describe("resolveBuilder", () => {
  let rootDir: string;
  const originalBuilder = process.env.NITRO_BUILDER;

  beforeAll(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-builder-"));
  });

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
    if (originalBuilder === undefined) {
      delete process.env.NITRO_BUILDER;
    } else {
      process.env.NITRO_BUILDER = originalBuilder;
    }
  });

  beforeEach(() => {
    delete process.env.NITRO_BUILDER;
    state.rolldown = undefined;
    state.vite = false;
  });

  async function resolve(opts: Partial<NitroOptions>) {
    const options = { rootDir, ...opts } as NitroOptions;
    await resolveBuilder(options);
    return options.builder;
  }

  it("defaults to rolldown when installed", async () => {
    state.rolldown = "/rolldown/index.mjs";
    expect(await resolve({ dev: true })).toBe("rolldown");
    expect(await resolve({ dev: false })).toBe("rolldown");
  });

  it("runs the dev server without a builder when rolldown is not installed", async () => {
    expect(await resolve({ dev: true })).toBe(false);
  });

  it("logs the dev server hint once", async () => {
    vi.resetModules();
    const { consola } = await import("consola");
    const { resolveBuilder: freshResolveBuilder } =
      await import("../../src/config/resolvers/builder.ts");
    const info = vi.spyOn(consola, "info").mockImplementation(() => {});
    try {
      for (let i = 0; i < 2; i++) {
        const options = { rootDir, dev: true } as NitroOptions;
        await freshResolveBuilder(options);
        expect(options.builder).toBe(false);
      }
      expect(info).toHaveBeenCalledOnce();
    } finally {
      info.mockRestore();
    }
  });

  it("keeps rolldown in development when bundler config is set", async () => {
    expect(await resolve({ dev: true, rollupConfig: { plugins: [] } })).toBe("rolldown");
    expect(await resolve({ dev: true, rolldownConfig: { platform: "node" } })).toBe("rolldown");
  });

  it("builds with rolldown (installed on demand) when it is not installed", async () => {
    expect(await resolve({ dev: false })).toBe("rolldown");
  });

  it("installs an explicit rolldown builder on build, not on config load", async () => {
    expect(await resolve({ dev: false, builder: "rolldown" })).toBe("rolldown");
  });

  it("keeps an explicit `builder: false`", async () => {
    state.rolldown = "/rolldown/index.mjs";
    expect(await resolve({ dev: false, builder: false })).toBe(false);
  });

  describe("vite config with nitro() plugin", () => {
    let viteRootDir: string;

    beforeAll(async () => {
      viteRootDir = join(rootDir, "vite-app");
      await mkdir(viteRootDir, { recursive: true });
      await writeFile(
        join(viteRootDir, "vite.config.ts"),
        `import { nitro } from "nitro/vite";\nexport default { plugins: [nitro()] };\n`
      );
    });

    it("uses vite to build", async () => {
      state.vite = true;
      expect(await resolve({ rootDir: viteRootDir, dev: false })).toBe("vite");
    });

    it("falls back with a warning in nitro dev", async () => {
      vi.resetModules();
      const { consola } = await import("consola");
      const { resolveBuilder: freshResolveBuilder } =
        await import("../../src/config/resolvers/builder.ts");
      const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
      try {
        state.vite = true;
        state.rolldown = "/rolldown/index.mjs";
        const options = { rootDir: viteRootDir, dev: true } as NitroOptions;
        await freshResolveBuilder(options);
        expect(options.builder).toBe("rolldown");
        expect(warn).toHaveBeenCalledOnce();
      } finally {
        warn.mockRestore();
      }
    });
  });
});
