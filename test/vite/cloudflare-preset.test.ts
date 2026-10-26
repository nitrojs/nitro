import { fileURLToPath } from "node:url";
import { readFile, rm } from "node:fs/promises";
import { join } from "pathe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const { createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:cloudflare preset (detected from `cloudflare.config.ts`)", () => {
  const rootDir = fileURLToPath(new URL("./cloudflare-preset-fixture", import.meta.url));
  const outputDir = join(rootDir, ".cloudflare/output/v0");

  const readJSON = (path: string) =>
    readFile(join(outputDir, path), "utf8").then((r) => JSON.parse(r));

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await rm(join(rootDir, ".cloudflare"), { recursive: true, force: true });
  });

  it.each([
    { mode: undefined, env: undefined, expected: "production" },
    { mode: "staging", env: undefined, expected: "staging" },
    { mode: "staging", env: "qa", expected: "qa" },
  ])(
    "records the build mode (mode: $mode, CLOUDFLARE_BUILD_MODE: $env)",
    async ({ mode, env, expected }) => {
      if (env) {
        vi.stubEnv("CLOUDFLARE_BUILD_MODE", env);
      }
      const builder = await createBuilder({
        root: rootDir,
        logLevel: "warn",
        mode,
        nitro: { vite: { path: import.meta.resolve(process.env.NITRO_VITE_PKG || "vite") } },
      });
      await builder.buildApp();

      expect(await readJSON("config.json")).toEqual({
        buildContext: { isPreview: false, mode: expected },
      });
      const worker = await readJSON("workers/default/worker.config.json");
      expect(worker.name).toBe(`app-${expected}`);
      expect(worker.env).toEqual({ ASSETS: { type: "assets" } });
      expect(worker.manifest).toMatchObject({
        type: "complete",
        mainModule: "index.mjs",
        modules: { "index.mjs": { type: "esm" } },
      });
    },
    60_000
  );
});
