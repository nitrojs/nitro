import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
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
}));

vi.mock("consola", () => ({
  consola: { info: vi.fn(), start: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

const { importVite, setRunningVite, viteImportOptions } =
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
  const createNitro = () => ({ options: { rootDir, vite: {} } }) as any;

  it("installs vite for the vite builder", async () => {
    await expect(importVite({ ...viteImportOptions(createNitro()), id })).rejects.toThrow(
      "is not installed"
    );
    expect(addDevDependency).toHaveBeenCalledOnce();
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
