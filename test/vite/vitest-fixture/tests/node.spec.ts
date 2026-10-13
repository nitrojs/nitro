// @vitest-environment node
import { expect, test } from "vitest";

test("per-file environment override", () => {
  expect(globalThis.__nitro__).toBeUndefined();
});
