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
      if (pathname.startsWith("/slow")) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return new Response("ok");
    },
  }),
}));

const { serverFetch } = await import("../../src/runtime/internal/app.ts");
const { MAX_SERVER_FETCH_DEPTH, withServerFetchGuard } =
  await import("../../src/runtime/internal/server-fetch-guard.ts");

const key = "GET https://nitro.test/unit";

describe("serverFetch recursion guard", () => {
  it("rejects a fetch loop instead of overflowing the stack", async () => {
    await expect(serverFetch("/loop")).rejects.toThrow(/serverFetch recursion limit exceeded/);
  });

  it("returns a rejected promise rather than throwing synchronously", async () => {
    let promise: Promise<Response> | undefined;
    expect(() => {
      promise = serverFetch("/loop");
    }).not.toThrow();
    await expect(promise).rejects.toThrow(/serverFetch recursion limit exceeded/);
  });

  it("allows sequential calls for the same URL", async () => {
    for (let i = 0; i < MAX_SERVER_FETCH_DEPTH + 2; i++) {
      const res = await serverFetch("/ok");
      expect(res.status).toBe(200);
    }
  });

  it("does not count independent concurrent calls as recursion", async () => {
    const responses = await Promise.all(
      Array.from({ length: MAX_SERVER_FETCH_DEPTH + 2 }, () => serverFetch("/slow"))
    );
    for (const res of responses) {
      expect(res.status).toBe(200);
    }
  });

  it("keeps sibling calls of one chain independent", async () => {
    await withServerFetchGuard(key, async () => {
      await Promise.all(
        Array.from({ length: MAX_SERVER_FETCH_DEPTH + 2 }, () =>
          withServerFetchGuard(key, () => Promise.resolve("ok"))
        )
      );
    });
  });

  it(`rejects past ${MAX_SERVER_FETCH_DEPTH} nested calls for the same URL`, async () => {
    const nest = (depth: number): Promise<string> =>
      withServerFetchGuard(key, () => (depth === 0 ? Promise.resolve("ok") : nest(depth - 1)));
    await expect(nest(MAX_SERVER_FETCH_DEPTH - 1)).resolves.toBe("ok");
    await expect(nest(MAX_SERVER_FETCH_DEPTH)).rejects.toThrow(
      /serverFetch recursion limit exceeded/
    );
    // The failed chain leaves no depth behind for the next call
    await expect(nest(0)).resolves.toBe("ok");
  });
});
