import { beforeEach, expect, test } from "vitest";
import { serverFetch } from "nitro";
import { useKV } from "nitro/kv";

beforeEach(async () => {
  await useKV().removeItem("visits");
});

test("GET /api/hello", async () => {
  const res = await serverFetch("/api/hello");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "Hello from Nitro!" });
});

test("GET /api/visits", async () => {
  await serverFetch("/api/visits");
  const res = await serverFetch("/api/visits");
  expect(await res.json()).toEqual({ visits: 2 });
  expect(await useKV().getItem("visits")).toBe(2);
});
