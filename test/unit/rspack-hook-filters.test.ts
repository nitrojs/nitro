import { describe, expect, it } from "vitest";
import { resolve } from "pathe";
import { matchFilter } from "../../src/build/rspack/_hooks.ts";

describe("rspack: hook filters", () => {
  it("matches `id` strings as globs (like Rollup)", () => {
    const id = resolve("server/routes/index.ts");
    expect(matchFilter("**/*.ts", id)).toBe(true);
    expect(matchFilter("server/**", id)).toBe(true);
    expect(matchFilter(id, id)).toBe(true);
    expect(matchFilter("**/*.js", id)).toBe(false);
    expect(matchFilter({ include: "**/*.ts", exclude: "**/routes/**" }, id)).toBe(false);
  });

  it("matches `id` filters with `/` separators", () => {
    expect(matchFilter(/\/routes\//, String.raw`C:\app\server\routes\index.ts`)).toBe(true);
    expect(matchFilter("**/routes/*.ts", String.raw`C:\app\server\routes\index.ts`)).toBe(true);
  });

  it("searches `code` strings", () => {
    expect(matchFilter("import.meta.dev", "if (import.meta.dev) {}", true)).toBe(true);
    expect(matchFilter({ exclude: "process.env" }, "process.env.FOO", true)).toBe(false);
    expect(matchFilter("**", "code", true)).toBe(false);
  });
});
