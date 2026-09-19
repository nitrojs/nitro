import { describe, expect, it } from "vitest";
import { isDenoSpecifier } from "../../src/presets/_utils/externals.ts";

describe("isDenoSpecifier", () => {
  it.each([
    "https://esm.sh/lodash-es",
    "npm:lodash-es",
    "npm:lodash-es@4.17.21",
    "jsr:@std/encoding",
    "jsr:@std/encoding@1/hex",
  ])("externalizes %s", (id) => {
    expect(isDenoSpecifier(id)).toBe(true);
  });

  it.each([
    "lodash-es",
    "node:crypto",
    "./local.ts",
    "../local.ts",
    "/abs/local.ts",
    "#nitro/app",
    "virtual:nitro",
    // Not a scheme Deno resolves, and externalizing it would silently break
    // a package that happens to be named this way.
    "npmlodash",
    "http://esm.sh/lodash-es",
  ])("bundles %s", (id) => {
    expect(isDenoSpecifier(id)).toBe(false);
  });
});
