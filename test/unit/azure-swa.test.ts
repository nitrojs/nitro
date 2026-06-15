import { describe, expect, it, vi } from "vitest";

vi.mock("#nitro/virtual/polyfills", () => ({}));
vi.mock("nitro/app", () => ({ useNitroApp: () => ({}) }));

import { resolveAzureSwaRequestUrl } from "../../src/presets/azure/runtime/azure-swa.ts";

describe("resolveAzureSwaRequestUrl", () => {
  it("uses x-ms-original-url as-is when present", () => {
    expect(
      resolveAzureSwaRequestUrl({
        headers: { "x-ms-original-url": "https://example.com/foo?bar=1" },
        params: {},
      } as Parameters<typeof resolveAzureSwaRequestUrl>[0])
    ).toBe("https://example.com/foo?bar=1");
  });

  it("builds an absolute URL for direct /api/* invocations", () => {
    expect(
      resolveAzureSwaRequestUrl({
        headers: {},
        params: { url: "hello" },
      } as Parameters<typeof resolveAzureSwaRequestUrl>[0])
    ).toBe("http://nitro.local/api/hello");
  });

  it("handles empty params.url", () => {
    expect(
      resolveAzureSwaRequestUrl({
        headers: {},
        params: {},
      } as Parameters<typeof resolveAzureSwaRequestUrl>[0])
    ).toBe("http://nitro.local/api/");
  });
});
