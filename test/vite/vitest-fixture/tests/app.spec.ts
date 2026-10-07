import { expect, test } from "vitest";
import { serverFetch } from "nitro/app";
import { useRuntimeConfig } from "nitro/runtime-config";
import { useStorage } from "nitro/storage";

test("runtime config", () => {
  expect(useRuntimeConfig().greeting).toBe("hello");
});

test("storage", async () => {
  await useStorage().setItem("foo", "bar");
  expect(await useStorage().getItem("foo")).toBe("bar");
});

test("routes", async () => {
  const res = await serverFetch("/hello");
  expect(await res.json()).toEqual({ greeting: "hello" });
});
