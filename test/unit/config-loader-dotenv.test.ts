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

// https://github.com/nitrojs/nitro/issues/4580
const ENV_KEY = "NITRO_TEST_APP_URL";
const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env[ENV_KEY];
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("config loader dotenv", () => {
  it("loads .env variables for route rules during build (non-dev)", async () => {
    delete process.env[ENV_KEY];
    const rootDir = await mkdtemp(join(tmpdir(), "nitro-config-dotenv-"));
    tempDirs.push(rootDir);

    await writeFile(join(rootDir, ".env"), `${ENV_KEY}=https://example.com\n`);
    await writeFile(
      join(rootDir, "nitro.config.ts"),
      `export default defineNitroConfig({
  preset: 'node-server',
  routeRules: {
    '/api/**': { headers: { 'x-app-url': process.env[${JSON.stringify(ENV_KEY)}] } }
  }
})
`
    );

    const { loadOptions } = await import("../../src/config/loader.ts");
    const options = await loadOptions({ rootDir, dev: false });

    expect(options.routeRules["/api/**"]?.headers?.["x-app-url"]).toBe("https://example.com");
  });
});
