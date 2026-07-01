import { describe, expectTypeOf, it } from "vitest";
import { serverFetch } from "nitro";
import type { ServerFetchInit } from "nitro/types";
import "../fixture/node_modules/.nitro/types/nitro.d.ts";

describe("serverFetch types", () => {
  it("infers response json from generated fixture routes", async () => {
    const hello = await serverFetch("/api/hello");
    expectTypeOf(await hello.json()).toEqualTypeOf<{ message: string }>();

    const hey = await serverFetch("/api/hey", { method: "GET" });
    expectTypeOf(await hey.json()).toEqualTypeOf<string>();

    const upload = await serverFetch("/api/upload", { method: "POST" });
    expectTypeOf(await upload.json()).toEqualTypeOf<string>();

    const unknown = await serverFetch("/unknown-resource");
    expectTypeOf(await unknown.json()).toEqualTypeOf<unknown>();
  });

  it("narrows ServerFetchInit methods to generated fixture routes", () => {
    expectTypeOf({ method: "POST" } as const).toExtend<ServerFetchInit<"/api/upload">>();
    expectTypeOf({ method: "GET" } as const).not.toExtend<ServerFetchInit<"/api/upload">>();
  });

  it("narrows methods to those available on generated fixture routes", async () => {
    // @ts-expect-error GET is not available for this known POST-only route.
    await serverFetch("/api/upload", { method: "GET" });
  });
});
