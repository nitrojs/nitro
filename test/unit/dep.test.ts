import * as fs from "node:fs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import * as exsolve from "exsolve";
import { consola } from "consola";
import { dirname, join } from "pathe";
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
const detectPackageManager = vi.fn(async () => ({ name: "pnpm" }) as { name: string } | undefined);
vi.mock("nypm", () => ({
  addDependency: vi.fn(),
  addDevDependency: (...args: unknown[]) => addDevDependency(...args),
  detectPackageManager: () => detectPackageManager(),
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
const installEnv = { NODE_ENV: "development" };

async function ensureDep(
  opts: typeof missingDep & {
    version?: string;
    autoInstall?: boolean;
    deps?: { paths?: Record<string, string>; install?: boolean };
  }
) {
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
    expect(addDevDependency).toHaveBeenCalledWith(missingDep.id, {
      cwd: missingDep.dir,
      env: installEnv,
    });
  });

  it("installs without prompting when there is no TTY", async () => {
    env.hasTTY = false;
    await ensureDep(missingDep);
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).toHaveBeenCalledWith(missingDep.id, {
      cwd: missingDep.dir,
      env: installEnv,
    });
  });

  it("installs with the package manager of the runtime when none is detected", async () => {
    env.isAgent = true;
    detectPackageManager.mockResolvedValueOnce(undefined);
    await ensureDep(missingDep);
    expect(addDevDependency).toHaveBeenCalledWith(missingDep.id, {
      cwd: missingDep.dir,
      packageManager: process.versions.bun ? "bun" : "npm",
      env: installEnv,
    });
  });

  it("installs with a non-production `NODE_ENV` during builds", async () => {
    env.isAgent = true;
    vi.stubEnv("NODE_ENV", "production");
    await ensureDep(missingDep);
    vi.unstubAllEnvs();
    expect(addDevDependency).toHaveBeenCalledWith(
      missingDep.id,
      expect.objectContaining({ env: { NODE_ENV: "development" } })
    );
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
    expect(addDevDependency).toHaveBeenCalledWith(missingDep.id, {
      cwd: missingDep.dir,
      env: installEnv,
    });
  });

  it("does not install with `autoInstall` or `install: true` in test mode", async () => {
    env.isTest = true;
    expect(await ensureDep({ ...missingDep, autoInstall: true })).toBeUndefined();
    expect(await ensureDep({ ...missingDep, deps: { install: true } })).toBeUndefined();
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("does not install in CI", async () => {
    Object.assign(env, { isCI: true, hasTTY: false });
    for (const opts of [missingDep, { ...missingDep, autoInstall: true }]) {
      expect(await ensureDep(opts)).toBeUndefined();
    }
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("installs in CI with `install: true`", async () => {
    Object.assign(env, { isCI: true, hasTTY: false });
    await ensureDep({ ...missingDep, deps: { install: true } });
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).toHaveBeenCalledWith(missingDep.id, {
      cwd: missingDep.dir,
      env: installEnv,
    });
  });

  it.each([
    ["interactively", {}],
    ["in an agent environment", { isAgent: true }],
    ["without a TTY", { hasTTY: false }],
  ])("does not install with `install: false` %s", async (_, flags) => {
    Object.assign(env, flags);
    prompt.mockResolvedValue(true);
    for (const opts of [
      { ...missingDep, deps: { install: false } },
      { ...missingDep, deps: { install: false }, autoInstall: true },
    ]) {
      expect(await ensureDep(opts)).toBeUndefined();
    }
    expect(prompt).not.toHaveBeenCalled();
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it.each([
    ["in CI", { isCI: true }, false],
    ["interactively", {}, false],
    ["with `autoInstall`", {}, true],
  ])(
    "does not install into a directory inside `node_modules` %s",
    async (_, flags, autoInstall) => {
      Object.assign(env, flags);
      prompt.mockResolvedValue(true);
      const dir = join(
        createProject(),
        "node_modules/.pnpm/framework@1.0.0/node_modules/framework"
      );
      mkdirSync(dir, { recursive: true });
      for (const opts of [
        { ...missingDep, dir, autoInstall, deps: { install: true } },
        { ...missingDep, dir: `${dir}/`, autoInstall, deps: { install: true } },
      ]) {
        expect(await ensureDep(opts)).toBeUndefined();
      }
      expect(prompt).not.toHaveBeenCalled();
      expect(addDevDependency).not.toHaveBeenCalled();
    }
  );
});

describe("ensureDep (resolve cache)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(env, { isAgent: true, isCI: false, isTest: false, hasTTY: false });
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
    const opts = { ...missingDep, version: "^2.0.0-rc.24", deps: { install: false } };
    expect(missingDepError(opts).message).toBe(
      "`nitro-missing-dep` is not installed. It is required for testing. Please add it to your dev dependencies (e.g. `npx nypm add -D nitro-missing-dep@^2.0.0-rc.24`)."
    );
    expect(missingDepError({ ...opts, dev: false }).message).toContain(
      "Please add it to your dependencies (e.g. `npx nypm add nitro-missing-dep@^2.0.0-rc.24`)."
    );
  });

  it("explains that nothing is installed in CI by default", async () => {
    const { missingDepError } = await import("../../src/utils/dep.ts");
    const hint = "not installed on demand in CI unless the `deps.install` option is enabled";
    expect(missingDepError(missingDep).message).toContain(hint);
    expect(missingDepError({ ...missingDep, deps: { install: false } }).message).not.toContain(
      hint
    );
    env.isCI = false;
    expect(missingDepError(missingDep).message).not.toContain(hint);
  });

  it("fails for a missing driver library when installing is disabled", async () => {
    const { ensureLibDeps } = await import("../../src/utils/dep.ts");
    const users = [{ name: "redis", options: {}, deps: [{ option: "lib", name: missingDep.id }] }];
    const opts = { dir: createProject(), label: "storage driver" };
    await expect(ensureLibDeps(users, opts)).rejects.toThrow(
      /`nitro-missing-dep` is not installed. It is required for the `redis` storage driver/
    );
    env.isCI = false;
    await expect(ensureLibDeps(users, { ...opts, deps: { install: false } })).rejects.toThrow(
      "is not installed"
    );
    env.isTest = true;
    await expect(
      ensureLibDeps(users, { ...opts, deps: { install: false } })
    ).resolves.toBeUndefined();
    expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining("is not installed"));
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("does not accept an explicit path for a driver library (imported by name)", async () => {
    const { ensureLibDeps } = await import("../../src/utils/dep.ts");
    const frameworkDir = createProject();
    installStub(missingDep.id, frameworkDir);
    const users = [{ name: "redis", options: {}, deps: [{ option: "lib", name: missingDep.id }] }];
    const paths = { [missingDep.id]: join(frameworkDir, "node_modules", missingDep.id) };
    await expect(
      ensureLibDeps(users, { dir: createProject(), label: "storage driver", deps: { paths } })
    ).rejects.toThrow("is not installed");
  });

  it("asks the framework to add it when resolving from inside `node_modules`", async () => {
    const { importDep, missingDepError } = await import("../../src/utils/dep.ts");
    const dir = join(createProject(), "node_modules/framework");
    mkdirSync(dir, { recursive: true });
    const opts = { ...missingDep, dir, version: "^1.0.0" };
    expect(missingDepError(opts).message).toBe(
      `\`nitro-missing-dep\` cannot be resolved from \`${dir}\`, which is inside \`node_modules\`. It is required for testing. The package that configures Nitro with this \`rootDir\` must add \`nitro-missing-dep@^1.0.0\` to its own dependencies (or provide it with the \`deps.paths\` option).`
    );
    await expect(importDep(opts)).rejects.toThrow(missingDepError(opts).message);
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("throws the same error from `importDep`", async () => {
    env.isTest = true; // Do not install
    const { importDep, missingDepError } = await import("../../src/utils/dep.ts");
    const opts = { ...missingDep, dir: createProject(), version: "^1.0.0", dev: false };
    await expect(importDep(opts)).rejects.toThrow(missingDepError(opts).message);
  });

  it("does not report a successful install when it is still not resolvable", async () => {
    addDevDependency.mockImplementation(() => {}); // Package manager did not install it
    expect(
      await ensureDep({ ...missingDep, dir: createProject(), deps: { install: true } })
    ).toBeUndefined();
    expect(addDevDependency).toHaveBeenCalledOnce();
    expect(consola.success).not.toHaveBeenCalled();
    expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining("cannot be resolved"));
  });
});

describe("explicit dependency paths (`deps.paths`)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(env, { isAgent: false, isCI: true, isTest: false, hasTTY: false });
  });

  /** A stub package outside of the project, as a framework would provide it. */
  function createFrameworkDep(version = "1.0.0") {
    const frameworkDir = createProject();
    installStub(missingDep.id, frameworkDir, version);
    return join(frameworkDir, "node_modules", missingDep.id);
  }

  it("resolves a dependency (and its subpaths) from its explicit path without installing", async () => {
    const { resolveDep } = await import("../../src/utils/dep.ts");
    const pkgDir = createFrameworkDep();
    const dir = createProject();
    for (const path of [pkgDir, join(pkgDir, "index.mjs"), pathToFileURL(pkgDir).href]) {
      const paths = { [missingDep.id]: path };
      expect(await ensureDep({ ...missingDep, dir, deps: { paths } })).toBe(
        join(pkgDir, "index.mjs")
      );
      expect(resolveDep(`${missingDep.id}/sub`, { dir, deps: { paths }, projectOnly: true })).toBe(
        join(pkgDir, "index.mjs")
      );
    }
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("prefers an explicit path over the copy installed in the project", async () => {
    const pkgDir = createFrameworkDep("2.0.0");
    const dir = createProject();
    installStub(missingDep.id, dir, "1.0.0");
    const paths = { [missingDep.id]: pkgDir };
    expect(await ensureDep({ ...missingDep, dir, deps: { paths } })).toBe(
      join(pkgDir, "index.mjs")
    );
  });

  it("resolves packages without `exports` from their explicit path only", async () => {
    const { resolveDep } = await import("../../src/utils/dep.ts");
    // Not in a `node_modules/<name>` directory, so it cannot reference itself
    const pkgDir = join(createProject(), "vendor", missingDep.id);
    mkdirSync(join(pkgDir, "lib"), { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({ name: missingDep.id, version: "1.0.0", main: "./lib/main" })
    );
    writeFileSync(join(pkgDir, "lib/main.js"), "module.exports = 1;");
    writeFileSync(join(pkgDir, "lib/sub.js"), "module.exports = 2;");
    // Another copy that would be found walking up from the explicit path
    installStub(missingDep.id, dirname(dirname(pkgDir)));
    const opts = { dir: createProject(), deps: { paths: { [missingDep.id]: pkgDir } } };
    expect(resolveDep(missingDep.id, opts)).toBe(join(pkgDir, "lib/main.js"));
    expect(resolveDep(`${missingDep.id}/lib/sub`, opts)).toBe(join(pkgDir, "lib/sub.js"));
    expect(() => resolveDep(`${missingDep.id}/missing`, opts)).toThrow(
      `in the \`${missingDep.id}\` package at`
    );
  });

  it("checks the version of an explicit `rolldown` path", async () => {
    const { importRolldown } = await import("../../src/build/rolldown/_import.ts");
    const frameworkDir = createProject();
    installStub("rolldown", frameworkDir, "0.1.0");
    await importRolldown(createProject(), {
      deps: { paths: { rolldown: join(frameworkDir, "node_modules/rolldown") } },
    });
    expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining("`rolldown@0.1.0`"));
  });

  it("checks the version of an explicit path", async () => {
    const pkgDir = createFrameworkDep("1.0.0");
    const paths = { [missingDep.id]: pkgDir };
    await ensureDep({ ...missingDep, dir: createProject(), deps: { paths }, version: "^2.0.0" });
    expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining("requires `^2.0.0`"));
  });

  it("throws for an explicit path that is not the package", async () => {
    const paths = { [missingDep.id]: createProject() };
    await expect(
      ensureDep({ ...missingDep, dir: createProject(), deps: { paths } })
    ).rejects.toThrow(
      `The \`deps.paths["${missingDep.id}"]\` option must point to the \`${missingDep.id}\` package`
    );
    expect(addDevDependency).not.toHaveBeenCalled();
  });
});
