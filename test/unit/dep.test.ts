import * as fs from "node:fs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as exsolve from "exsolve";
import { consola } from "consola";
import { join } from "pathe";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", { spy: true });
vi.mock("exsolve", { spy: true });

// Mutable environment flags, applied per test case
const env = { isAgent: false, isCI: false, isTest: false, hasTTY: true };

vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  get isAgent() {
    return env.isAgent;
  },
  get isCI() {
    return env.isCI;
  },
  get isTest() {
    return env.isTest;
  },
  get hasTTY() {
    return env.hasTTY;
  },
}));

const addDevDependency = vi.fn();
vi.mock("nypm", () => ({
  addDependency: vi.fn(),
  addDevDependency: (...args: unknown[]) => addDevDependency(...args),
}));

const prompt = vi.fn();
vi.mock("consola", () => ({
  consola: {
    info: vi.fn(),
    start: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    prompt: (...args: unknown[]) => prompt(...args),
  },
}));

const missingDep = { id: "nitro-missing-dep", dir: process.cwd(), reason: "testing" };

async function ensureDep(opts: typeof missingDep & { version?: string; autoInstall?: boolean }) {
  const mod = await import("../../src/utils/dep.ts");
  return mod.ensureDep(opts);
}

async function isDepInstalled(id: string, dir: string) {
  const mod = await import("../../src/utils/dep.ts");
  return mod.isDepInstalled(id, { dir });
}

async function resolveDep(id: string, dir: string) {
  const mod = await import("../../src/utils/dep.ts");
  return mod.resolveDep(id, { dir, projectOnly: true });
}

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A project directory without `node_modules`. */
function createProject() {
  const dir = mkdtempSync(join(tmpdir(), "nitro-dep-"));
  tmpDirs.push(dir);
  return dir;
}

/** Install a stub package into `dir` (what the package manager would do). */
function installStub(id: string, dir: string, version = "1.0.0") {
  const pkgDir = join(dir, "node_modules", id);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify({
      name: id,
      version,
      type: "module",
      exports: { ".": "./index.mjs", "./sub": "./index.mjs" },
    })
  );
  writeFileSync(join(pkgDir, "index.mjs"), "export default 1;");
}

describe("ensureDep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(env, { isAgent: false, isCI: false, isTest: false, hasTTY: true });
  });

  it("resolves an installed dependency without installing", async () => {
    const resolved = await ensureDep({ ...missingDep, id: "consola" });
    expect(resolved).toBeTruthy();
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("installs without prompting in an agent environment", async () => {
    env.isAgent = true;
    await ensureDep(missingDep);
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).toHaveBeenCalledWith(missingDep.id, { cwd: missingDep.dir });
  });

  it("installs without prompting when there is no TTY", async () => {
    env.hasTTY = false;
    await ensureDep(missingDep);
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).toHaveBeenCalledWith(missingDep.id, { cwd: missingDep.dir });
  });

  it("prompts in an interactive environment", async () => {
    prompt.mockResolvedValue(false);
    expect(await ensureDep(missingDep)).toBeUndefined();
    expect(prompt).toHaveBeenCalledOnce();
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("installs without prompting with `autoInstall`", async () => {
    await ensureDep({ ...missingDep, autoInstall: true });
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).toHaveBeenCalledWith(missingDep.id, { cwd: missingDep.dir });
  });

  it("does not install with `autoInstall` in test mode", async () => {
    env.isTest = true;
    expect(await ensureDep({ ...missingDep, autoInstall: true })).toBeUndefined();
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).not.toHaveBeenCalled();
  });
});

describe("ensureDep (resolve cache)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(env, { isAgent: false, isCI: true, isTest: false, hasTTY: false });
    addDevDependency.mockImplementation((spec: string, opts: { cwd: string }) => {
      installStub(spec.split("@")[0]!, opts.cwd);
    });
  });

  it("resolves a dependency installed on demand from then on", async () => {
    const dir = createProject();
    const opts = { ...missingDep, dir };
    expect(await isDepInstalled(opts.id, dir)).toBe(false);

    expect(await ensureDep(opts)).toBeTruthy();
    expect(addDevDependency).toHaveBeenCalledOnce();

    // Previous failed lookups are not cached anymore
    expect(await isDepInstalled(opts.id, dir)).toBe(true);
    expect(await ensureDep(opts)).toBeTruthy();
    expect(addDevDependency).toHaveBeenCalledOnce();
  });

  it("resolves a dependency installed after a failed lookup", async () => {
    env.isTest = true; // Do not install
    const dir = createProject();
    const opts = { ...missingDep, dir };
    expect(await ensureDep(opts)).toBeUndefined();

    installStub(opts.id, dir); // e.g. installed manually while `nitro dev` is running
    expect(await ensureDep(opts)).toBeTruthy();
    expect(await isDepInstalled(opts.id, dir)).toBe(true);
  });

  it("installs once for concurrent calls", async () => {
    const dir = createProject();
    const opts = { ...missingDep, dir };
    const results = await Promise.all([ensureDep(opts), ensureDep(opts), ensureDep(opts)]);
    expect(results.every(Boolean)).toBe(true);
    expect(addDevDependency).toHaveBeenCalledOnce();
  });

  it("resolves a dependency installed manually after a failed lookup", async () => {
    const dir = createProject();
    expect(await isDepInstalled(missingDep.id, dir)).toBe(false);
    expect(await resolveDep(`${missingDep.id}/sub`, dir)).toBeUndefined();

    installStub(missingDep.id, dir); // e.g. installed manually while `nitro dev` is running
    expect(await isDepInstalled(missingDep.id, dir)).toBe(true);
    expect(await resolveDep(`${missingDep.id}/sub`, dir)).toBeTruthy();
  });

  it("uses cached lookups for installed dependencies", async () => {
    const dir = createProject();
    installStub(missingDep.id, dir);
    await resolveDep(missingDep.id, dir);

    vi.mocked(exsolve.resolveModulePath).mockClear();
    for (let i = 0; i < 3; i++) {
      expect(await ensureDep({ ...missingDep, dir })).toBeTruthy();
      expect(await resolveDep(`${missingDep.id}/sub`, dir)).toBeTruthy();
    }
    const uncached = vi
      .mocked(exsolve.resolveModulePath)
      .mock.calls.filter(([, opts]) => opts?.cache === false);
    expect(uncached).toEqual([]);
  });

  it("checks the installed version once", async () => {
    const dir = createProject();
    installStub(missingDep.id, dir);
    const opts = { ...missingDep, dir, version: "^1.0.0" };
    expect(await ensureDep(opts)).toBeTruthy();

    vi.mocked(fs.readFileSync).mockClear();
    expect(await ensureDep(opts)).toBeTruthy();
    expect(await ensureDep(opts)).toBeTruthy();
    expect(
      vi.mocked(fs.readFileSync).mock.calls.filter(([path]) => String(path).includes(dir))
    ).toEqual([]);
    expect(consola.warn).not.toHaveBeenCalled();
  });
});

describe("ensureDep (version check)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(env, { isAgent: false, isCI: false, isTest: true, hasTTY: false });
  });

  it.each([
    // Prerelease ranges (`unstorage`, `unenv`) compare majors
    ["1.17.5", "^2.0.0-alpha.10", true],
    ["1.10.0", "^2.0.0-rc.24", true],
    ["2.0.0-alpha.10", "^2.0.0-alpha.10", false],
    ["2.1.0", "^2.0.0-alpha.10", false],
    // `0.x` ranges (`db0`) compare minors
    ["0.3.0", "^0.4.1", true],
    ["0.4.5", "^0.4.1", false],
    ["1.0.0", "^0.4.1", true],
    // Simple ranges
    ["8.0.0-beta.1", "^8", false],
    ["7.2.0", "^7 || ^8", false],
    ["9.0.0", "^7 || ^8", true],
    // Other formats are not checked
    ["1.0.0", ">=2", false],
  ])("`%s` for `%s` (warns: %s)", async (installed, range, warns) => {
    const dir = createProject();
    installStub(missingDep.id, dir, installed);
    expect(await ensureDep({ ...missingDep, dir, version: range })).toBeTruthy();
    expect(vi.mocked(consola.warn).mock.calls.length > 0).toBe(warns);
  });
});

describe("missing dependencies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(env, { isAgent: false, isCI: true, isTest: false, hasTTY: false });
  });

  it("includes the supported version in the install command", async () => {
    const { missingDepError } = await import("../../src/utils/dep.ts");
    const opts = { ...missingDep, version: "^2.0.0-rc.24" };
    expect(missingDepError(opts).message).toBe(
      "`nitro-missing-dep` is not installed. It is required for testing. Please add it to your dev dependencies (e.g. `npx nypm add -D nitro-missing-dep@^2.0.0-rc.24`)."
    );
    expect(missingDepError({ ...opts, dev: false }).message).toContain(
      "Please add it to your dependencies (e.g. `npx nypm add nitro-missing-dep@^2.0.0-rc.24`)."
    );
  });

  it("throws the same error from `importDep`", async () => {
    env.isTest = true; // Do not install
    const { importDep, missingDepError } = await import("../../src/utils/dep.ts");
    const opts = { ...missingDep, dir: createProject(), version: "^1.0.0", dev: false };
    await expect(importDep(opts)).rejects.toThrow(missingDepError(opts).message);
  });

  it("does not report a successful install when it is still not resolvable", async () => {
    addDevDependency.mockImplementation(() => {}); // Package manager did not install it
    expect(await ensureDep({ ...missingDep, dir: createProject() })).toBeUndefined();
    expect(addDevDependency).toHaveBeenCalledOnce();
    expect(consola.success).not.toHaveBeenCalled();
    expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining("cannot be resolved"));
  });
});
