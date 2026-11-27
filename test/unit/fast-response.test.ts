import { afterEach, describe, expect, it, vi } from "vitest";

const originalResponse = globalThis.Response;
const hadBun = "Bun" in globalThis;

describe("fast-response polyfill", () => {
  afterEach(() => {
    vi.resetModules();
    globalThis.Response = originalResponse;
    if (!hadBun) {
      delete (globalThis as any).Bun;
    }
  });

  it("does not override `globalThis.Response` when running on Bun", async () => {
    const sentinel = class NativeResponse extends originalResponse {};
    globalThis.Response = sentinel;
    if (!hadBun) {
      (globalThis as any).Bun = {};
    }

    await import("../../src/runtime/internal/polyfills/fast-response.ts");
    expect(globalThis.Response).toBe(sentinel);
  });

  it.skipIf(hadBun)("replaces `globalThis.Response` with `FastResponse` on Node.js", async () => {
    const { FastResponse } = await import("srvx");
    const sentinel = class CustomResponse extends originalResponse {};
    globalThis.Response = sentinel;

    await import("../../src/runtime/internal/polyfills/fast-response.ts");
    expect(globalThis.Response).toBe(FastResponse);
  });
});
