import { describe, expect, it, vi } from "vitest";

const { normalizeBunResponse } = await import("../../src/runtime/internal/vite/dev-worker.mjs");

describe("vite dev worker", () => {
  it("leaves responses untouched outside Bun", () => {
    const response = new Response("ok", {
      headers: { "content-length": "2" },
    });

    expect(normalizeBunResponse(response)).toBe(response);
  });

  it("drops explicit content length before Bun serves the response", async () => {
    vi.stubGlobal("Bun", {});
    try {
      const response = normalizeBunResponse(
        new Response("ok", {
          headers: {
            "content-length": "2",
            "content-type": "text/plain",
          },
        })
      );

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.has("content-length")).toBe(false);
      expect(response.headers.get("content-type")).toBe("text/plain");
      expect(await response.text()).toBe("ok");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
