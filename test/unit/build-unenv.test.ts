import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "pathe";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { build, copyPublicAssets, createNitro, prepare } from "../../src/builder.ts";
import * as dep from "../../src/utils/dep.ts";

vi.mock("../../src/utils/dep.ts", { spy: true });

// The vite builder loads `nitro/vite` from `dist/`, so it would not use (or mock) the sources here
const builders = ["rolldown", "rollup"] as const;

const unenvCalls = () =>
  vi.mocked(dep.ensureDep).mock.calls.filter(([opts]) => opts.id === "unenv");

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function buildApp(
  builder: (typeof builders)[number],
  server: string,
  opts: { preset?: string; files?: Record<string, string> } = {}
) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-build-unenv-"));
  tmpDirs.push(rootDir);
  const appFiles = {
    "package.json": JSON.stringify({ type: "module" }),
    "server.ts": server,
    ...opts.files,
  };
  for (const [path, contents] of Object.entries(appFiles)) {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true });
    writeFileSync(join(rootDir, path), contents);
  }
  const nitro = await createNitro({
    rootDir,
    builder,
    preset: opts.preset || "cloudflare-module",
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

  it("bundles default imports of mocked Node.js internals", async () => {
    const code = await buildApp(
      builder,
      `import wrap from "node:_stream_wrap";\nexport default { fetch: () => new Response(typeof wrap) };`
    );
    expect(code).not.toMatch(/["']node:_stream_wrap["']/);
  });

  it("keeps the own unenv copy of dependencies", async () => {
    const pkg = (name: string, exports: unknown) =>
      JSON.stringify({ name, type: "module", exports });
    const code = await buildApp(
      builder,
      `import marker from "dep";\nexport default { fetch: () => new Response(marker) };`,
      {
        files: {
          "node_modules/dep/package.json": pkg("dep", "./index.mjs"),
          "node_modules/dep/index.mjs": `export { default } from "unenv/custom-marker";`,
          "node_modules/dep/node_modules/unenv/package.json": pkg("unenv", { "./*": "./*.mjs" }),
          "node_modules/dep/node_modules/unenv/custom-marker.mjs": `export default "nested-unenv-marker";`,
        },
      }
    );
    expect(code).toContain("nested-unenv-marker");
    expect(unenvCalls()).toEqual([]);
  });

  it("installs unenv before bundling for runtimes without Node.js compatibility", async () => {
    const code = await buildApp(
      builder,
      `import { Readable } from "node:stream";\nexport default { fetch: () => new Response(typeof Readable) };`,
      { preset: "winterjs" }
    );
    expect(unenvCalls()).toEqual([
      [expect.objectContaining({ reason: expect.stringContaining("node:process") })],
    ]);
    expect(code).not.toMatch(/from\s*["'](node:)?(process|stream|buffer|timers)["']/);
  });
});
