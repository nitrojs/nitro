import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { writeDevWorkerEntry } from "../../src/build/vite/_dev-worker.ts";

describe("vite dev worker entry", () => {
  let buildDir: string;
  const warn = vi.fn();

  beforeEach(async () => {
    buildDir = await mkdtemp(join(tmpdir(), "nitro-dev-worker-entry-"));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    warn.mockReset();
    await rm(buildDir, { recursive: true, force: true });
  });

  async function generate() {
    const nitro = {
      options: {
        rootDir: fileURLToPath(new URL("../..", import.meta.url)),
        buildDir,
        features: {},
        experimental: {},
      },
      logger: { warn },
    } as any;
    return readFile(await writeDevWorkerEntry(nitro), "utf8");
  }

  test("keeps the default reload timeout when NITRO_DEV_RELOAD_TIMEOUT is unset", async () => {
    vi.stubEnv("NITRO_DEV_RELOAD_TIMEOUT", "");
    expect(await generate()).not.toContain("setReloadWaitTimeout(");
  });

  test("passes NITRO_DEV_RELOAD_TIMEOUT to the worker", async () => {
    vi.stubEnv("NITRO_DEV_RELOAD_TIMEOUT", "300000");
    expect(await generate()).toContain("setReloadWaitTimeout(300000);");
  });

  test("caps NITRO_DEV_RELOAD_TIMEOUT to the largest timer delay", async () => {
    vi.stubEnv("NITRO_DEV_RELOAD_TIMEOUT", "1e12");
    expect(await generate()).toContain(`setReloadWaitTimeout(${2 ** 31 - 1});`);
  });

  test.each(["abc", "0", "-1"])(
    "ignores an invalid NITRO_DEV_RELOAD_TIMEOUT (%s)",
    async (value) => {
      vi.stubEnv("NITRO_DEV_RELOAD_TIMEOUT", value);
      expect(await generate()).not.toContain("setReloadWaitTimeout(");
      expect(warn).toHaveBeenCalledOnce();
    }
  );
});
