import { mkdtempSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { build, copyPublicAssets, createNitro, prepare } from "../../src/builder.ts";
import * as dep from "../../src/utils/dep.ts";

vi.mock("../../src/utils/dep.ts", { spy: true });

const builders = ["rolldown", "rollup", "vite"] as const;

const unenvCalls = () =>
  vi.mocked(dep.ensureDep).mock.calls.filter(([opts]) => opts.id === "unenv");

async function buildApp(builder: (typeof builders)[number], server: string) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-build-unenv-"));
  writeFileSync(join(rootDir, "package.json"), JSON.stringify({ type: "module" }));
  writeFileSync(join(rootDir, "server.ts"), server);
  const nitro = await createNitro({
    rootDir,
    builder,
    preset: "cloudflare-module",
    compatibilityDate: "2025-01-01",
    logLevel: 0,
  });
  try {
    await prepare(nitro);
    await copyPublicAssets(nitro);
    await build(nitro);
  } finally {
    await nitro.close();
  }
  const serverDir = nitro.options.output.serverDir;
  const files = await readdir(serverDir, { recursive: true });
  const code = await Promise.all(
    files.filter((f) => f.endsWith(".mjs")).map((f) => readFile(join(serverDir, f), "utf8"))
  );
  return code.join("\n");
}

describe.each(builders)("unenv on demand (%s)", (builder) => {
  beforeEach(() => {
    vi.mocked(dep.ensureDep).mockClear();
    return () => vi.mocked(dep.ensureDep).mockRestore();
  });

  it("does not require unenv when no polyfill is used", async () => {
    await buildApp(
      builder,
      `export default { fetch: () => new Response(String(process.env.FOO)) };`
    );
    expect(unenvCalls()).toEqual([]);
  });

  it("requires unenv to bundle unsupported Node.js modules", async () => {
    const code = await buildApp(
      builder,
      `import inspector from "node:inspector";\nexport default { fetch: () => new Response(typeof inspector.open) };`
    );
    expect(unenvCalls()).toEqual([
      [expect.objectContaining({ reason: expect.stringContaining("node:inspector") })],
    ]);
    expect(code).not.toMatch(/["']node:inspector["']/);
    expect(code).toContain("__unenv__");
  });

  it("fails with an actionable error when unenv is missing", async () => {
    const actual = await vi.importActual<typeof dep>("../../src/utils/dep.ts");
    vi.mocked(dep.ensureDep).mockImplementation((opts) =>
      opts.id === "unenv" ? Promise.resolve(undefined) : actual.ensureDep(opts)
    );
    await expect(
      buildApp(
        builder,
        `import vm from "node:vm";\nexport default { fetch: () => new Response(typeof vm) };`
      )
    ).rejects.toThrow(/`unenv` is not installed[\s\S]*node:vm/);
  });
});
