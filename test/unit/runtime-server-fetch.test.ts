import { describe, expect, it, vi } from "vitest";

vi.mock("#nitro/virtual/routing", () => ({
  findRouteRules: () => ({ routeRules: {}, cache: undefined }),
}));

vi.mock("#nitro/virtual/app", () => ({
  initNitroPlugins: () => {},
  createNitroApp: () => ({
    fetch: async (req: Request) => {
      const pathname = new URL(req.url).pathname;
      if (pathname.startsWith("/loop")) {
        const { serverFetch } = await import("../../src/runtime/internal/app.ts");
        return serverFetch(pathname);
      }
      return new Response("ok");
    },
  }),
}));

const { serverFetch } = await import("../../src/runtime/internal/app.ts");
const { MAX_SERVER_FETCH_DEPTH, beginServerFetch } =
  await import("../../src/runtime/internal/server-fetch-guard.ts");

describe("serverFetch recursion guard", () => {
  it("rejects a fetch loop instead of overflowing the stack", async () => {
    await expect(serverFetch("/loop")).rejects.toThrow(/serverFetch recursion limit exceeded/);
  });

  it("allows sequential calls for the same URL", async () => {
    for (let i = 0; i < MAX_SERVER_FETCH_DEPTH + 2; i++) {
      const res = await serverFetch("/ok");
      expect(res.status).toBe(200);
    }
  });

  it("resets the counter when the call settles", async () => {
    const release = beginServerFetch("GET https://nitro.test/unit");
    release();
    expect(() => beginServerFetch("GET https://nitro.test/unit")).not.toThrow();
  });

  it(`throws past ${MAX_SERVER_FETCH_DEPTH} nested calls for the same URL`, () => {
    const releases = Array.from({ length: MAX_SERVER_FETCH_DEPTH }, () =>
      beginServerFetch("GET https://nitro.test/nested")
    );
    expect(() => beginServerFetch("GET https://nitro.test/nested")).toThrow(
      /serverFetch recursion limit exceeded/
    );
    for (const release of releases) {
      release();
    }
    expect(() => beginServerFetch("GET https://nitro.test/nested")).not.toThrow();
  });
});
