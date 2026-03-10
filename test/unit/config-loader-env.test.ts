import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

const originalNodeEnv = process.env.NODE_ENV;
const tempDirs: string[] = [];

async function createFixtureConfig() {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-config-env-"));
  tempDirs.push(rootDir);

  await writeFile(
    join(rootDir, "nitro.config.ts"),
    `export default defineNitroConfig({
  preset: 'node-server',
  routeRules: {
    '/base': { headers: { 'x-env': 'base' } }
  },
  $production: {
    routeRules: {
      '/prod': { headers: { 'x-env': 'production' } }
    }
  },
  $development: {
    routeRules: {
      '/dev': { headers: { 'x-env': 'development' } }
    }
  }
})
`
  );

  return rootDir;
}

afterEach(async () => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("config loader env layers", () => {
  it("applies $production when NODE_ENV is unset and dev=false", async () => {
    delete process.env.NODE_ENV;
    const rootDir = await createFixtureConfig();

    const { loadOptions } = await import("../../src/config/loader.ts");
    const options = await loadOptions({ rootDir, dev: false });

    expect(options.routeRules["/prod"]?.headers?.["x-env"]).toBe("production");
    expect(options.routeRules["/dev"]).toBeUndefined();
    expect(options.routeRules["/base"]?.headers?.["x-env"]).toBe("base");
  });

  it("applies $development when NODE_ENV is unset and dev=true", async () => {
    delete process.env.NODE_ENV;
    const rootDir = await createFixtureConfig();

    const { loadOptions } = await import("../../src/config/loader.ts");
    const options = await loadOptions({ rootDir, dev: true });

    expect(options.routeRules["/dev"]?.headers?.["x-env"]).toBe("development");
    expect(options.routeRules["/prod"]).toBeUndefined();
    expect(options.routeRules["/base"]?.headers?.["x-env"]).toBe("base");
  });
});
