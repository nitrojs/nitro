import { describe, expect, it, vi } from "vitest";

vi.mock("#nitro/virtual/polyfills", () => ({}));
vi.mock("nitro/app", () => ({ useNitroApp: () => ({}) }));

import { resolveAzureSwaRequestUrl } from "../../src/presets/azure/runtime/azure-swa.ts";
import { azureResponseBody } from "../../src/presets/azure/runtime/_utils.ts";

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

describe("azureResponseBody", () => {
  it("returns undefined when response has no body", async () => {
    const response = new Response(null, { status: 204 });
    await expect(azureResponseBody(response)).resolves.toBeUndefined();
  });

  it("returns text for text content types", async () => {
    const response = new Response("hello", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
    await expect(azureResponseBody(response)).resolves.toBe("hello");
  });

  it("returns a Buffer for binary content types", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const response = new Response(bytes, {
      headers: { "content-type": "image/png" },
    });
    const body = await azureResponseBody(response);
    expect(body).toBeInstanceOf(Buffer);
    expect(body).toEqual(Buffer.from(bytes));
  });
});
