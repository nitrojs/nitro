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

  async function generate(options: Record<string, unknown> = {}) {
    const nitro = {
      options: {
        rootDir: fileURLToPath(new URL("../..", import.meta.url)),
        buildDir,
        features: {},
        experimental: {},
        ...options,
      },
      logger: { warn },
    } as any;
    return readFile(await writeDevWorkerEntry(nitro), "utf8");
  }

  test("keeps the default reload timeout when NITRO_DEV_RELOAD_TIMEOUT is unset", async () => {
    vi.stubEnv("NITRO_DEV_RELOAD_TIMEOUT", undefined);
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

  test.each(["abc", "0", "-1", "0.4"])(
    "ignores an invalid NITRO_DEV_RELOAD_TIMEOUT (%s)",
    async (value) => {
      vi.stubEnv("NITRO_DEV_RELOAD_TIMEOUT", value);
      expect(await generate()).not.toContain("setReloadWaitTimeout(");
      expect(warn).toHaveBeenCalledOnce();
    }
  );

  test("does not add srvx plugins without tracing channels", async () => {
    expect(await generate()).not.toContain("srvx");
  });

  // #4923
  test("passes the srvx tracing plugin to the runner when enabled", async () => {
    const entry = await generate({ tracingChannel: { srvx: true, h3: false } });
    expect(entry).toMatch(
      /import \{ tracingPlugin as srvxTracing \} from "file:\/\/.+\/tracing\.mjs";/
    );
    expect(entry).toContain("export const plugins = [srvxTracing()];");
  });

  test("skips the srvx tracing plugin when only h3 tracing is enabled", async () => {
    expect(await generate({ tracingChannel: { srvx: false, h3: true } })).not.toContain("srvx");
  });
});
