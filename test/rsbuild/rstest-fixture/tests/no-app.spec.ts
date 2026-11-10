import { expect, test } from "@rstest/core";

test("the app is created on first use", () => {
  expect(
    Object.getOwnPropertyDescriptor(globalThis.__nitro__ || {}, "default")?.value
  ).toBeUndefined();
});
