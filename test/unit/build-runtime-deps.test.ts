import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "pathe";
import { resolvePackageJSON } from "pkg-types";
import { pkgDir } from "#nitro/meta";
import { glob } from "tinyglobby";
import { parseAst } from "rolldown/parseAst";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as exsolve from "exsolve";
import type { NitroConfig } from "nitro/types";
import { build, createNitro, prepare } from "../../src/builder.ts";
import { getDepMeta } from "../../src/utils/_deps.ts";
import * as dep from "../../src/utils/dep.ts";

vi.mock("../../src/utils/dep.ts", { spy: true });
vi.mock("exsolve", { spy: true });

// The vite builder loads `nitro/vite` from `dist/`, so it would not use (or mock) the sources here
const builders = ["rolldown", "rollup"] as const;

// Config resolvers import (`importDep`), the bundler only resolves (`ensureDep`)
// With the defaults of the dependency manifest applied
const depCalls = (id: string) =>
  [...vi.mocked(dep.importDep).mock.calls, ...vi.mocked(dep.ensureDep).mock.calls]
    .filter(([opts]) => opts.id === id)
    .map(([opts]) => [{ ...getDepMeta(opts.id), ...opts }]);

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function buildApp(
  builder: (typeof builders)[number],
  server: string,
  config: Omit<NitroConfig, "rootDir"> = {}
) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-build-runtime-deps-"));
  tmpDirs.push(rootDir);
  const appFiles = {
    "package.json": JSON.stringify({ type: "module" }),
    "server.ts": server,
    "node_modules/.keep": "",
  };
  for (const [path, contents] of Object.entries(appFiles)) {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true });
    writeFileSync(join(rootDir, path), contents);
  }
  symlinkSync(pkgDir, join(rootDir, "node_modules/nitro"), "junction");
  const nitro = await createNitro({
    rootDir,
    builder,
    preset: "cloudflare-module",
    compatibilityDate: "2025-01-01",
    logLevel: 0,
    ...config,
  });
  try {
    await prepare(nitro);
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

describe.each(builders)("optional runtime dependencies (%s)", (builder) => {
  beforeEach(() => {
    vi.mocked(dep.ensureDep).mockClear();
    vi.mocked(dep.importDep).mockClear();
    vi.mocked(exsolve.resolveModulePath).mockClear();
    return () => vi.mocked(dep.ensureDep).mockRestore();
  });

  it("does not require unstorage, db0 or ocache when they are not used", async () => {
    await buildApp(builder, `export default { fetch: () => new Response("ok") };`, {
      routeRules: { "/**": { headers: { "x-test": "1" } } },
    });
    expect(depCalls("unstorage")).toEqual([]);
    expect(depCalls("db0")).toEqual([]);
    expect(depCalls("ocache")).toEqual([]);
  });

  it("requires unstorage when `nitro/kv` is imported", async () => {
    const code = await buildApp(
      builder,
      `import { useKV } from "nitro/kv";\nexport default { fetch: async () => new Response(String(await useKV().getItem("foo"))) };`
    );
    // Once per import (`unstorage`, `unstorage/tracing`), `ensureDep` installs only once
    expect(depCalls("unstorage")).not.toEqual([]);
    expect(depCalls("unstorage")).toEqual(
      depCalls("unstorage").map(() => [
        expect.objectContaining({ autoInstall: true, reason: expect.stringContaining("nitro/kv") }),
      ])
    );
    expect(depCalls("db0")).toEqual([]);
    expect(code).toContain("prefixStorage");
    // Installed: resolved without bypassing the resolve cache
    const uncachedLookups = vi
      .mocked(exsolve.resolveModulePath)
      .mock.calls.filter(
        ([id, opts]) => /^unstorage(\/|$)/.test(String(id)) && opts?.cache === false
      );
    expect(uncachedLookups).toEqual([]);
  });

  it("requires db0 when `nitro/database` is imported", async () => {
    await buildApp(
      builder,
      `import { useDatabase } from "nitro/database";\nexport default { fetch: () => new Response(typeof useDatabase) };`
    );
    expect(depCalls("db0")).toEqual([
      [
        expect.objectContaining({
          autoInstall: true,
          reason: expect.stringContaining("nitro/database"),
        }),
      ],
    ]);
    expect(depCalls("unstorage")).toEqual([]);
  });

  it("requires ocache when `nitro/cache` is imported", async () => {
    const code = await buildApp(
      builder,
      `import { defineCachedFunction } from "nitro/cache";\nconst cached = defineCachedFunction(() => "ok", { maxAge: 60 });\nexport default { fetch: async () => new Response(await cached()) };`
    );
    expect(depCalls("ocache")).not.toEqual([]);
    expect(depCalls("ocache")).toEqual(
      depCalls("ocache").map(() => [
        expect.objectContaining({ autoInstall: true, reason: expect.stringContaining("caching") }),
      ])
    );
    expect(depCalls("unstorage")).toEqual([]);
    expect(code).toContain("createMemoryStorage");
  });

  it("requires ocache for `cache` route rules", async () => {
    await buildApp(builder, `export default { fetch: () => new Response("ok") };`, {
      routeRules: { "/**": { swr: 60 } },
    });
    expect(depCalls("ocache")).not.toEqual([]);
  });

  it("bundles ocache from its explicit path (`deps.paths`)", async () => {
    // A copy of `ocache` outside the project, as a framework would provide it
    const ocacheDir = join(mkdtempSync(join(tmpdir(), "nitro-build-runtime-deps-fw-")), "ocache");
    tmpDirs.push(dirname(ocacheDir));
    const pkgDir = dirname(await resolvePackageJSON("ocache", { url: import.meta.url }));
    cpSync(pkgDir, ocacheDir, { recursive: true });
    const entry = relative(pkgDir, fileURLToPath(import.meta.resolve("ocache")));
    appendFileSync(join(ocacheDir, entry), `\nconsole.log("framework-ocache");\n`);
    const code = await buildApp(
      builder,
      `import { defineCachedFunction } from "nitro/cache";\nconst cached = defineCachedFunction(() => "ok", { maxAge: 60 });\nexport default { fetch: async () => new Response(await cached()) };`,
      { deps: { paths: { ocache: ocacheDir } } }
    );
    expect(code).toContain("framework-ocache");
  });

  it("requires unstorage when kv is configured", async () => {
    await buildApp(builder, `export default { fetch: () => new Response("ok") };`, {
      kv: { data: { driver: "memory" } },
    });
    expect(depCalls("unstorage")).toEqual([
      [
        expect.objectContaining({
          autoInstall: true,
          reason: expect.stringContaining("`kv` config"),
        }),
      ],
    ]);
  });

  it("requires unstorage when the cache uses kv", async () => {
    await buildApp(builder, `export default { fetch: () => new Response("ok") };`, {
      cache: { driver: "kv" },
    });
    expect(depCalls("unstorage")).toEqual([
      [
        expect.objectContaining({
          autoInstall: true,
          reason: expect.stringContaining("cache.driver"),
        }),
      ],
    ]);
  });

  it("requires db0 when database is configured", async () => {
    await buildApp(builder, `export default { fetch: () => new Response("ok") };`, {
      experimental: { database: true },
      database: { default: { connector: "cloudflare-d1", options: { bindingName: "DB" } } },
    });
    expect(depCalls("db0")).toEqual([
      [
        expect.objectContaining({
          autoInstall: true,
          reason: expect.stringContaining("`database` config"),
        }),
      ],
    ]);
  });

  it("fails with an actionable error when unstorage is missing", async () => {
    const actual = await vi.importActual<typeof dep>("../../src/utils/dep.ts");
    vi.mocked(dep.ensureDep).mockImplementation((opts) =>
      opts.id === "unstorage" ? Promise.resolve(undefined) : actual.ensureDep(opts)
    );
    await expect(
      buildApp(
        builder,
        `import { useKV } from "nitro/kv";\nexport default { fetch: () => new Response(typeof useKV) };`
      )
    ).rejects.toThrow(/`unstorage` is not installed[\s\S]*nitro\/kv/);
  });
});

describe("optional runtime dependencies (sources)", () => {
  it("are not imported by build-time code", async () => {
    const srcDir = fileURLToPath(new URL("../../src", import.meta.url));
    const files = await glob(["**/*.ts"], {
      cwd: srcDir,
      ignore: ["runtime/**", "presets/*/runtime/**", "types/**"],
    });
    const offenders: string[] = [];
    for (const file of files) {
      const ast = parseAst(await readFile(join(srcDir, file), "utf8"), { lang: "ts" });
      for (const node of ast.body) {
        if (
          node.type === "ImportDeclaration" &&
          node.importKind !== "type" &&
          /^(unstorage|db0|ocache)(\/|$)/.test(node.source.value)
        ) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
