import { describe, expect, it } from "vitest";
import {
  BASE_SOURCE_EXTENSIONS,
  getScanPattern,
  getSourceExtensionPattern,
  getSourceExtensions,
  normalizeSourceExtensions,
  stripSourceExtension,
  TS_SOURCE_EXTENSIONS,
} from "../../src/utils/source-extensions.ts";

describe("source extensions", () => {
  it("normalizes user input", () => {
    expect(normalizeSourceExtensions([" civet ", ".res", "", ".", "  "])).toEqual([
      ".civet",
      ".res",
    ]);
    expect(normalizeSourceExtensions()).toEqual([]);
  });

  it("prefers TypeScript over the compiled JavaScript sibling", () => {
    const extensions = getSourceExtensions({ sourceExtensions: [] });
    expect(extensions.indexOf(".ts")).toBeLessThan(extensions.indexOf(".js"));
    expect(extensions.indexOf(".mts")).toBeLessThan(extensions.indexOf(".mjs"));
  });

  it("appends custom extensions without duplicating built-ins", () => {
    expect(getSourceExtensions({ sourceExtensions: ["civet", ".ts"] })).toEqual([
      ...BASE_SOURCE_EXTENSIONS,
      ".civet",
    ]);
  });

  it("builds an anchored-safe regex pattern", () => {
    const re = new RegExp(
      String.raw`^server\.(?:${getSourceExtensionPattern({ sourceExtensions: [".civet"] })})$`
    );
    expect(re.test("server.ts")).toBe(true);
    expect(re.test("server.civet")).toBe(true);
    expect(re.test("server.txt")).toBe(false);
    // `.` in an extension must not act as a wildcard
    expect(re.test("serverXcivet")).toBe(false);
  });

  it("restricts the TS-only pattern to TypeScript plus custom extensions", () => {
    const pattern = getSourceExtensionPattern(
      { sourceExtensions: [".civet"] },
      TS_SOURCE_EXTENSIONS
    );
    const re = new RegExp(String.raw`\.(?:${pattern})$`);
    expect(re.test("/a/b.ts")).toBe(true);
    expect(re.test("/a/b.civet")).toBe(true);
    expect(re.test("/a/b.js")).toBe(false);
  });

  it("builds the glob scan pattern", () => {
    expect(getScanPattern({ sourceExtensions: [".civet"] })).toBe(
      "**/*.{ts,js,mts,mjs,cts,cjs,tsx,jsx,civet}"
    );
  });

  it("strips only known source extensions", () => {
    const options = { sourceExtensions: [".civet"] };
    expect(stripSourceExtension("api/foo.get.ts", options)).toBe("api/foo.get");
    expect(stripSourceExtension("api/foo.civet", options)).toBe("api/foo");
    expect(stripSourceExtension("api/foo.md", options)).toBe("api/foo.md");
  });
});
