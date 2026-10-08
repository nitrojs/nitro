import { expect, test, vi } from "vitest";
import { serverFetch } from "nitro";

vi.mock("../utils/value.ts", () => ({ value: "mocked" }));

test("vi.mock applies to modules imported by nitro plugins", async () => {
  await serverFetch("/hello");
  expect((globalThis as any).__pluginValue).toBe("mocked");
});
