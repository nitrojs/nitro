import { expect, rs, test } from "@rstest/core";
import { serverFetch } from "nitro";

rs.mock("../utils/value.ts", () => ({ value: "mocked" }));

test("rs.mock applies to modules imported by nitro plugins", async () => {
  await serverFetch("/hello");
  expect((globalThis as any).__pluginValue).toBe("mocked");
});
