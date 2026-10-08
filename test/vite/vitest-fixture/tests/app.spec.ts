import { expect, test } from "vitest";
import { serverFetch } from "nitro/app";
import { useRuntimeConfig } from "nitro/runtime-config";
import { useKV } from "nitro/kv";

test("runtime config", () => {
  expect(useRuntimeConfig().greeting).toBe("hello");
});

test("kv", async () => {
  await useKV().setItem("foo", "bar");
  expect(await useKV().getItem("foo")).toBe("bar");
});

test("routes", async () => {
  const res = await serverFetch("/hello");
  expect(await res.json()).toEqual({ greeting: "hello" });
});

test("ssr entry", async () => {
  const res = await serverFetch("/about");
  expect(await res.text()).toBe("<h1>hello from /about</h1>");
});
