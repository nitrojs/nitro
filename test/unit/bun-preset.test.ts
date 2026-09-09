import { describe, expect, it } from "vitest";
import { parseBunIdleTimeout } from "../../src/presets/bun/runtime/_utils.ts";

describe("bun preset", () => {
  it.each([
    ["0", 0],
    ["255", 255],
  ])("accepts an idle timeout of %s", (value, expected) => {
    expect(parseBunIdleTimeout(value)).toBe(expected);
  });

  it.each([undefined, "", "abc", "-1", "256"])("ignores an invalid idle timeout of %s", (value) => {
    expect(parseBunIdleTimeout(value)).toBeUndefined();
  });
});
