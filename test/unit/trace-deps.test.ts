import { describe, expect, it } from "vitest";
import { resolveTraceDeps } from "../../src/build/plugins/externals.ts";

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
