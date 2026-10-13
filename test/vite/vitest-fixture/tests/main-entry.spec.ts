import { expect, test } from "vitest";
import { serverFetch } from "nitro";

test("serverFetch from the main entry", async () => {
  const res = await serverFetch("/hello");
  expect(await res.json()).toEqual({ greeting: "hello" });
});
