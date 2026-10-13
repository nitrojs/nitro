import { beforeEach, describe, expect, it, vi } from "vitest";

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

async function ensureDep(opts: typeof missingDep) {
  const mod = await import("../../src/utils/dep.ts");
  return mod.ensureDep(opts);
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
});
