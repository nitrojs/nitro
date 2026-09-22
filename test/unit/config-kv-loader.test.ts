import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import { loadOptions } from "../../src/config/loader.ts";
import { resolveStorageMounts } from "../../src/utils/storage.ts";

const tempDirs: string[] = [];

async function createFixture(config: string) {
  const rootDir = await mkdtemp(join(tmpdir(), "nitro-config-kv-"));
  tempDirs.push(rootDir);
  await writeFile(join(rootDir, "nitro.config.ts"), `export default ${config}\n`);
  return rootDir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("kv config loader", () => {
  it("replaces a mount when `$development` switches its driver", async () => {
    const rootDir = await createFixture(`{
      kv: { db: { driver: "redis", host: "prod.example.com" } },
      $development: { kv: { db: { driver: "fs", base: "./.data/db" } } },
    }`);
    const options = await loadOptions({ rootDir, dev: true });
    expect(options.kv.db).toEqual({ driver: "fs", base: "./.data/db" });
  });

  it("merges mount options when `$development` keeps the same driver", async () => {
    const rootDir = await createFixture(`{
      kv: { db: { driver: "fs", base: "./.data/db", readOnly: true } },
      $development: { kv: { db: { driver: "fs", base: "./.data/dev" } } },
    }`);
    const options = await loadOptions({ rootDir, dev: true });
    expect(options.kv.db).toEqual({ driver: "fs", base: "./.data/dev", readOnly: true });
  });

  it("applies `$production` and `$prerender` kv when prerendering", async () => {
    const rootDir = await createFixture(`{
      kv: { db: { driver: "redis", host: "prod.example.com" } },
      $development: { kv: { dev: { driver: "memory" } } },
      $production: { kv: { prod: { driver: "memory" } } },
      $prerender: { kv: { db: { driver: "fs", base: "./.data/db" } } },
    }`);
    const options = await loadOptions({ rootDir, preset: "nitro-prerender" });
    expect(options.kv).toEqual({
      db: { driver: "fs", base: "./.data/db" },
      prod: { driver: "memory" },
    });
  });

  it("keeps applying deprecated `devStorage` when prerendering", async () => {
    const rootDir = await createFixture(`{
      kv: { db: { driver: "memory" } },
      devStorage: { cache: { driver: "fs", base: "./.data/cache" } },
    }`);
    const options = await loadOptions({ rootDir, preset: "nitro-prerender" });
    const mounts = Object.fromEntries(resolveStorageMounts(options).map((m) => [m.path, m.name]));
    expect(mounts).toEqual({ db: "memory", cache: "fs" });
  });
});
