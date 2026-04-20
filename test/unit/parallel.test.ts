import { describe, expect, it } from "vitest";
import { runParallel } from "../../src/utils/parallel.ts";

describe("runParallel", () => {
  it("processes falsy inputs", async () => {
    const seen: Array<string | number | boolean> = [];

    const { errors } = await runParallel(
      new Set<string | number | boolean>(["", 0, false]),
      (input) => {
        seen.push(input);
      },
      { concurrency: 1 }
    );

    expect(errors).toEqual([]);
    expect(seen).toEqual(["", 0, false]);
  });
});
