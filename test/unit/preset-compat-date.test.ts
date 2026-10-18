import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadOptions } from "../../src/config/loader.ts";

vi.mock("nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("cloudflare-dev preset ignores compatibilityDate", () => {
  it("uses cloudflare-dev in development with an old compatibilityDate", async () => {
    const rootDir = await realpath(await mkdtemp(join(tmpdir(), "nitro-compat-date-")));
    tempDirs.push(rootDir);
    const options = await loadOptions({
      rootDir,
      dev: true,
      preset: "cloudflare-module",
      compatibilityDate: "2024-04-03",
      logLevel: 0,
    });
    expect(options.preset).toBe("cloudflare-dev");
    expect(options.devServer.runner).toBe("miniflare");
    expect(options.compatibilityDate.default).toBe("2024-04-03");
  });
});
