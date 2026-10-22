import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { nitro } from "../../src/vite.ts";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite: service environments without a nitro dependency", () => {
  let rootDir: string;
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    // Outside of the Nitro package, so `selfEnv` aliases the `nitro/*` exports
    // to this package's own files (the global CLI case).
    rootDir = mkdtempSync(join(tmpdir(), "nitro-self-env-"));
    mkdirSync(join(rootDir, "app"), { recursive: true });
    writeFileSync(
      join(rootDir, "app/entry-server.ts"),
      `import { useKV } from "nitro/kv";\nexport default { fetch: () => new Response(typeof useKV) };`
    );
    server = await createServer({
      root: rootDir,
      configFile: false,
      logLevel: "warn",
      plugins: [nitro()],
    });
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  test("proxies `nitro/*` in service environments", async () => {
    const entry = join(rootDir, "app/entry-server.ts");
    const resolved = await server.environments.ssr.pluginContainer.resolveId("nitro/kv", entry);
    expect(resolved?.id).toBe("\0nitro-env-proxy:nitro/kv");
  });

  test("resolves `nitro/*` self aliases in the nitro environment", async () => {
    const entry = join(rootDir, "app/entry-server.ts");
    const resolved = await server.environments.nitro.pluginContainer.resolveId("nitro/kv", entry);
    expect(resolved?.id).toMatch(/dist\/runtime\/kv\.mjs$/);
    expect(resolved?.id).not.toContain("\0nitro-env-proxy:");
  });

  test("resolves `nitro/*` self aliases in the production nitro environment", async () => {
    const { createBuilder } = (await import(
      process.env.NITRO_VITE_PKG || "vite"
    )) as typeof import("vite");
    const builder = await createBuilder({
      root: rootDir,
      configFile: false,
      logLevel: "warn",
      plugins: [nitro()],
    });
    const alias = builder.environments.nitro.config.resolve.alias || [];
    const kvAlias = alias.find((a) => typeof a.find === "string" && a.find === "nitro/kv");
    expect(kvAlias?.replacement).toMatch(/dist\/runtime\/kv\.mjs$/);
  });
});
