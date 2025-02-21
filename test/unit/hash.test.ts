import { describe, expect, it, vi } from "vitest";
import { hash as ohashV1, objectHash } from "ohash-v1";
import { hash, serialize } from "../../src/runtime/internal/hash";

describe("cache: hash consistency", async () => {
  const inputs = [
    "test",
    123,
    true,
    false,
    null,
    undefined,
    {},
    { foo: "bar" },
    new Uint8Array(0),
    new Uint8Array([1, 2, 3]),
    [1, "test", true],
    Buffer.from("test"),
  ];
  for (const input of inputs) {
    it(JSON.stringify(input), () => {
      expect(
        hash(input),
        `${serialize(input)} should be ${objectHash(input)}`
      ).toBe(ohashV1(input));
    });
  }
});
