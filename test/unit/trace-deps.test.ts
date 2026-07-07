import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectDirectDepRoots,
  collectPackageRoots,
  externals,
  resolveTraceDeps,
} from "../../src/build/plugins/externals.ts";

const defaults = {
  builtinPackages: ["sharp", "canvas"],
  builtinFullTrace: ["prisma"],
};

describe("resolveTraceDeps", () => {
  it("merges user deps with builtins", () => {
    const result = resolveTraceDeps(["my-pkg"], defaults);
    expect(result.includePattern).toBeDefined();
    expect(result.includePattern!.test("sharp/index.js")).toBe(true);
    expect(result.includePattern!.test("my-pkg/lib.js")).toBe(true);
  });

  it("deduplicates entries", () => {
    const result = resolveTraceDeps(["sharp"], defaults);
    const source = result.includePattern!.source;
    const matches = source.match(/sharp/g);
    // "sharp" appears only once — pattern is shared across both branches
    expect(matches!.length).toBe(1);
  });

  it("negates builtin packages with ! prefix", () => {
    const result = resolveTraceDeps(["!sharp"], defaults);
    expect(result.includePattern!.test("sharp/index.js")).toBe(false);
    expect(result.includePattern!.test("canvas/lib.js")).toBe(true);
  });

  it("negates user packages with ! prefix", () => {
    const result = resolveTraceDeps(["my-pkg", "!my-pkg"], defaults);
    expect(result.includePattern!.test("my-pkg/lib.js")).toBe(false);
  });

  it("supports full trace with * suffix", () => {
    const result = resolveTraceDeps(["my-pkg*"], defaults);
    expect(result.includePattern!.test("my-pkg/lib.js")).toBe(true);
    expect(result.fullTraceInclude).toContain("my-pkg");
    expect(result.fullTraceInclude).toContain("prisma");
  });

  it("returns named deps as traceInclude (builtins + user, RegExp excluded)", () => {
    const result = resolveTraceDeps(["my-pkg", /my-.*-pkg/], defaults);
    expect(result.traceInclude).toContain("sharp");
    expect(result.traceInclude).toContain("canvas");
    expect(result.traceInclude).toContain("my-pkg");
    // RegExp entries cannot be resolved by name and must be excluded
    expect(result.traceInclude!.every((d) => typeof d === "string")).toBe(true);
  });

  it("excludes negated packages from traceInclude", () => {
    const result = resolveTraceDeps(["!sharp"], defaults);
    expect(result.traceInclude).not.toContain("sharp");
    expect(result.traceInclude).toContain("canvas");
  });

  it("returns undefined traceInclude when all deps are negated", () => {
    const result = resolveTraceDeps(["!sharp", "!canvas"], defaults);
    expect(result.traceInclude).toBeUndefined();
  });

  it("throws on bare ! selector", () => {
    expect(() => resolveTraceDeps(["!"], defaults)).toThrow('Invalid traceDeps selector: "!"');
  });

  it("throws on bare * selector", () => {
    expect(() => resolveTraceDeps(["*"], defaults)).toThrow('Invalid traceDeps selector: "*"');
  });

  it("supports RegExp entries", () => {
    const result = resolveTraceDeps([/my-.*-pkg/], defaults);
    expect(result.includePattern!.test("my-cool-pkg/index.js")).toBe(true);
  });

  it("returns undefined includePattern when all deps are negated", () => {
    const result = resolveTraceDeps(["!sharp", "!canvas"], defaults);
    expect(result.includePattern).toBeUndefined();
  });

  it("returns undefined includePattern with no deps at all", () => {
    const result = resolveTraceDeps([], {
      builtinPackages: [],
      builtinFullTrace: [],
    });
    expect(result.includePattern).toBeUndefined();
    expect(result.fullTraceInclude).toBeUndefined();
  });

  it("escapes special regex characters in package names", () => {
    const result = resolveTraceDeps(["@scope/my-pkg"], defaults);
    expect(result.includePattern!.test("@scope/my-pkg/lib.js")).toBe(true);
    expect(result.includePattern!.test("@scope_my-pkg/lib.js")).toBe(false);
  });

  it("matches bare imports (anchored at start)", () => {
    const result = resolveTraceDeps(["sharp"], defaults);
    expect(result.includePattern!.test("sharp/native.node")).toBe(true);
    expect(result.includePattern!.test("sharp")).toBe(true);
    expect(result.includePattern!.test("not-sharp/lib.js")).toBe(false);
  });

  it("matches non-scoped package in absolute node_modules path", () => {
    const result = resolveTraceDeps(["sharp"], defaults);
    expect(result.includePattern!.test("/project/node_modules/sharp")).toBe(true);
    expect(result.includePattern!.test("/project/node_modules/sharp/lib/index.js")).toBe(true);
    expect(result.includePattern!.test("/project/node_modules/sharpened")).toBe(false);
  });

  it("throws on empty string selector", () => {
    expect(() => resolveTraceDeps([""], defaults)).toThrow('Invalid traceDeps selector: ""');
  });

  it("filters negated packages from fullTraceInclude", () => {
    const result = resolveTraceDeps(["my-pkg*", "!prisma"], defaults);
    expect(result.fullTraceInclude).toContain("my-pkg");
    expect(result.fullTraceInclude).not.toContain("prisma");
  });

  it("negation of full-trace user entry removes from both", () => {
    const result = resolveTraceDeps(["my-pkg*", "!my-pkg"], defaults);
    expect(result.includePattern!.test("my-pkg/lib.js")).toBe(false);
    expect(result.fullTraceInclude).not.toContain("my-pkg");
  });

  it("matches resolved absolute paths with node_modules", () => {
    const result = resolveTraceDeps(["@fixture/utils"], defaults);
    expect(
      result.includePattern!.test("/Users/dev/project/node_modules/@fixture/utils/index.mjs")
    ).toBe(true);
    expect(result.includePattern!.test("/Users/dev/project/node_modules/@fixture/utils")).toBe(
      true
    );
    expect(
      result.includePattern!.test(
        "C:\\Users\\dev\\project\\node_modules\\@fixture/utils\\index.mjs"
      )
    ).toBe(true);
    expect(
      result.includePattern!.test("C:\\Users\\dev\\project\\node_modules\\@fixture/utils")
    ).toBe(true);
  });
});

describe("collectPackageRoots", () => {
  it("extracts the package root from bundled module ids", () => {
    const roots = collectPackageRoots([
      "/app/node_modules/nitropage/dist/server.mjs",
      "/app/node_modules/@scope/pkg/lib/index.js",
    ]);
    expect(roots).toEqual(["/app/node_modules/nitropage", "/app/node_modules/@scope/pkg"]);
  });

  it("resolves pnpm nested roots (deepest node_modules wins)", () => {
    const roots = collectPackageRoots([
      "/app/node_modules/.pnpm/nitropage@1.0.0/node_modules/nitropage/dist/index.mjs",
    ]);
    // The real pnpm location — so `traceInclude` names it declares resolve from here.
    expect(roots).toEqual(["/app/node_modules/.pnpm/nitropage@1.0.0/node_modules/nitropage"]);
  });

  it("deduplicates roots across many files of the same package", () => {
    const roots = collectPackageRoots([
      "/app/node_modules/nitropage/dist/a.mjs",
      "/app/node_modules/nitropage/dist/b.mjs",
      "/app/node_modules/nitropage/package.json",
    ]);
    expect(roots).toEqual(["/app/node_modules/nitropage"]);
  });

  it("ignores non-node_modules and virtual ids", () => {
    expect(
      collectPackageRoots(["/app/src/index.ts", "\0virtual:nitro", "#internal/nitro"])
    ).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(collectPackageRoots([])).toBeUndefined();
  });
});

describe("collectDirectDepRoots", () => {
  const appDir = fileURLToPath(new URL("fixtures/direct-deps", import.meta.url));

  it("resolves roots of dependencies, devDependencies and optionalDependencies", () => {
    const roots = collectDirectDepRoots(appDir, ["node"]);
    expect(roots).toContain(`${appDir}/node_modules/dep-a`); // dependencies
    expect(roots).toContain(`${appDir}/node_modules/@scope/dep-c`); // devDependencies (scoped)
    expect(roots).toContain(`${appDir}/node_modules/dep-b`); // optionalDependencies
  });

  it("skips deps that are declared but not installed", () => {
    const roots = collectDirectDepRoots(appDir, ["node"]);
    expect(roots.some((r) => r.endsWith("missing-dep"))).toBe(false);
  });

  it("returns an empty array when rootDir has no package.json", () => {
    const noPkgDir = fileURLToPath(new URL("fixtures", import.meta.url));
    expect(collectDirectDepRoots(noPkgDir, ["node"])).toEqual([]);
  });
});

describe("externals resolveId (unresolvable native deps)", () => {
  const plugin = externals({
    rootDir: "/app",
    conditions: ["node"],
    exclude: [],
    include: [], // builtins (sharp, bcrypt, …) become the include pattern
    trace: {},
  });
  // Resolution always fails, mimicking a native dep imported from a generated
  // entry (e.g. `.nitro/vite/services/ssr`) outside its declaring package scope.
  const handler = (plugin.resolveId as any).handler.bind({ resolve: async () => null });

  it("externalizes an include-matched native dep by name when unresolvable", async () => {
    const result = await handler("sharp", "/app/.nitro/services/ssr/index.js", {});
    expect(result).toMatchObject({ external: true, id: "sharp" });
  });

  it("does not externalize an unresolvable dep that is not in the include set", async () => {
    const result = await handler("left-pad", "/app/.nitro/services/ssr/index.js", {});
    expect(result).toBeNull();
  });
});
