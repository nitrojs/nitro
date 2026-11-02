import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, normalize } from "pathe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  isTest: false,
  isCI: true,
}));

const addDevDependency = vi.fn();
vi.mock("nypm", () => ({
  addDependency: vi.fn(),
  addDevDependency: (...args: unknown[]) => addDevDependency(...args),
  detectPackageManager: async () => ({ name: "pnpm" }),
}));

vi.mock("consola", () => ({
  consola: { info: vi.fn(), start: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

const { importVite, setRunningVite, viteDepPaths, viteImportOptions } =
  await import("../../src/build/vite/_import.ts");

describe("importVite", () => {
  let rootDir: string;

  beforeAll(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-vite-import-"));
  });

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    addDevDependency.mockReset();
  });

  const id = "nitro-missing-vite";
  const createNitro = (deps: { install?: boolean } = { install: true }) =>
    ({ options: { rootDir, vite: {}, deps } }) as any;

  it("installs vite for the vite builder", async () => {
    await expect(importVite({ ...viteImportOptions(createNitro()), id })).rejects.toThrow(
      "is not installed"
    );
    expect(addDevDependency).toHaveBeenCalledOnce();
  });

  it("does not install vite in CI by default", async () => {
    await expect(importVite({ ...viteImportOptions(createNitro({})), id })).rejects.toThrow(
      "is not installed"
    );
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("throws instead of installing vite when the running vite cannot be located", async () => {
    const nitro = createNitro();
    setRunningVite(nitro, { resolve: { alias: [] } } as any);
    await expect(importVite({ ...viteImportOptions(nitro), id })).rejects.toThrow(
      "Set the `vite.path` option"
    );
    expect(addDevDependency).not.toHaveBeenCalled();
  });
});

describe("viteDepPaths", () => {
  const rootDir = "/project";
  const viteEntry = normalize(fileURLToPath(import.meta.resolve("vite")));
  const viteDir = viteEntry.slice(0, viteEntry.lastIndexOf("/dist/"));
  const runningVite = (nitro: any) =>
    setRunningVite(nitro, {
      resolve: {
        alias: [{ replacement: `/@fs/${viteDir.replace(/^\//, "")}/dist/client/env.mjs` }],
      },
    } as any);

  it("adds the running vite to resolve rolldown through it", () => {
    const nitro = { options: { rootDir, vite: {}, deps: { paths: { unstorage: "/x" } } } } as any;
    runningVite(nitro);
    expect(viteDepPaths(nitro)).toEqual({
      unstorage: "/x",
      vite: `${viteDir}/dist/client/env.mjs`,
    });
  });

  it("keeps an explicit vite path", () => {
    const nitro = {
      options: { rootDir, vite: { path: "/vite" }, deps: { paths: { vite: "/vite" } } },
    } as any;
    runningVite(nitro);
    expect(viteDepPaths(nitro)).toEqual({ vite: "/vite" });
  });

  it("keeps the paths without a vite", () => {
    const nitro = { options: { rootDir, vite: {}, deps: { paths: {} } } } as any;
    expect(viteDepPaths(nitro)).toEqual({});
  });
});
