import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("#nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

const gc = await (async (): Promise<() => void> => {
  if ("Bun" in globalThis) {
    return () => (globalThis as any).Bun.gc(true);
  }
  const { setFlagsFromString } = await import("node:v8");
  setFlagsFromString("--expose-gc");
  const { runInNewContext } = await import("node:vm");
  return runInNewContext("gc") as () => void;
})();

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function createTempDir() {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "nitro-config-leak-")));
  tempDirs.push(dir);
  return dir;
}

describe("config loader defineNitroConfig global", () => {
  it("does not retain the overrides from the first call", async () => {
    const { loadOptions } = await import("../../src/config/loader.ts");
    const rootDir = await createTempDir();

    const loadWithMarker = async () => {
      const marker = () => {};
      await loadOptions({ rootDir, dev: false, preset: "node-server", marker } as any, {
        dotenv: false,
      });
      return new WeakRef(marker);
    };

    const ref = await loadWithMarker();

    await loadOptions({ rootDir, dev: false, preset: "node-server" }, { dotenv: false });

    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      gc();
    }

    expect(ref.deref()).toBeUndefined();
  });
});
