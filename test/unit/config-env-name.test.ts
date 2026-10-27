import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import { createNitro } from "../../src/builder.ts";
import { baseBuildConfig } from "../../src/build/config.ts";
import { loadOptions } from "../../src/config/loader.ts";

const tempDirs: string[] = [];

async function createFixture(config = "{}") {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-env-name-"));
  tempDirs.push(rootDir);
  await writeFile(join(rootDir, "nitro.config.ts"), `export default ${config}\n`);
  return rootDir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("envName", () => {
  it("defaults to `production` for builds", async () => {
    const rootDir = await createFixture();
    const options = await loadOptions({ rootDir, dev: false });
    expect(options.envName).toBe("production");
  });

  it("defaults to `development` in dev", async () => {
    const rootDir = await createFixture();
    const options = await loadOptions({ rootDir, dev: true });
    expect(options.envName).toBe("development");
  });

  it("uses a custom env name and applies its overrides", async () => {
    const rootDir = await createFixture(`{
      runtimeConfig: { target: "default" },
      $staging: { runtimeConfig: { target: "staging" } },
    }`);
    const options = await loadOptions({ rootDir }, { c12: { envName: "staging" } });
    expect(options.envName).toBe("staging");
    expect(options.runtimeConfig.target).toBe("staging");
  });

  it("is `production` while prerendering", async () => {
    const rootDir = await createFixture();
    const options = await loadOptions({ rootDir, preset: "nitro-prerender" });
    expect(options.envName).toBe("production");
  });

  it("uses the first name of a list and applies all overrides", async () => {
    const rootDir = await createFixture(`{
      runtimeConfig: { target: "default", prerender: false },
      $staging: { runtimeConfig: { target: "staging" } },
      $prerender: { runtimeConfig: { prerender: true } },
    }`);
    const options = await loadOptions(
      { rootDir, preset: "nitro-prerender" },
      { c12: { envName: ["staging", "prerender"] } }
    );
    expect(options.envName).toBe("staging");
    expect(options.runtimeConfig).toMatchObject({ target: "staging", prerender: true });
  });

  it("skips empty names of a list", async () => {
    const rootDir = await createFixture();
    const options = await loadOptions({ rootDir }, { c12: { envName: ["", "staging"] } });
    expect(options.envName).toBe("staging");
  });

  it("is injected as `import.meta.envName`", async () => {
    const rootDir = await createFixture();
    const nitro = await createNitro({ rootDir, logLevel: 0 }, { c12: { envName: "staging" } });
    const { replacements } = await baseBuildConfig(nitro);
    await nitro.close();
    expect(replacements["import.meta.envName"]).toBe(JSON.stringify("staging"));
  });
});
