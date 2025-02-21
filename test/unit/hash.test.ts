import { describe, expect, it, vi } from "vitest";
import { hash as ohashV1 } from "ohash-v1";
import { hash } from "../../src/runtime/internal/hash";

describe("cache: hash consistency", async () => {
  const inputs = ["test", 123, true, false, null, undefined, {}];
  for (const input of inputs) {
    it(`${input}`, () => {
      expect(hash(input)).toBe(ohashV1(input));
    });
  }
});
