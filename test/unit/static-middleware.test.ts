import { createApp, toWebHandler } from "h3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import staticHandler from "../../src/runtime/internal/static";

const { getAsset, isPublicAssetURL, readAsset } = vi.hoisted(() => ({
  getAsset: vi.fn(),
  isPublicAssetURL: vi.fn(),
  readAsset: vi.fn(),
}));

vi.mock("#nitro-internal-virtual/public-assets", () => ({
  getAsset,
  isPublicAssetURL,
  readAsset,
}));

const app = createApp({ onError: () => {} });
app.use((event) => {
  event.node.res.setHeader("Cache-Control", "max-age=3600");
});
app.use(staticHandler);
const fetchAsset = toWebHandler(app);

function mockAsset(id: string, size = 1) {
  getAsset.mockImplementation((_id: string) =>
    _id === id
      ? { etag: '"test"', mtime: Date.now(), type: "text/plain", size }
      : undefined
  );
  isPublicAssetURL.mockReturnValue(true);
}

describe("runtime static middleware", () => {
  beforeEach(() => {
    getAsset.mockReset();
    isPublicAssetURL.mockReset();
    readAsset.mockReset();
  });

  it("serves a matched asset", async () => {
    mockAsset("/foo.txt");
    readAsset.mockResolvedValue(new TextEncoder().encode("foo"));

    const res = await fetchAsset(new Request("http://localhost/foo.txt"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("foo");
  });

  it("responds with 404 when a matched asset has no data behind it", async () => {
    mockAsset("/foo.txt");
    readAsset.mockResolvedValue(undefined);

    const res = await fetchAsset(new Request("http://localhost/foo.txt"));
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  // The `inline` reader hands back its payload without a promise.
  it("responds with 404 when a synchronous reader has no data", async () => {
    mockAsset("/foo.txt");
    readAsset.mockReturnValue(undefined);

    const res = await fetchAsset(new Request("http://localhost/foo.txt"));
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("propagates reader errors", async () => {
    mockAsset("/foo.txt");
    readAsset.mockRejectedValue(
      Object.assign(new Error("EACCES"), { code: "EACCES" })
    );

    const res = await fetchAsset(new Request("http://localhost/foo.txt"));
    expect(res.status).toBe(500);
  });

  it("serves an empty asset instead of treating it as missing", async () => {
    mockAsset("/empty.txt", 0);
    readAsset.mockResolvedValue(new Uint8Array());

    const res = await fetchAsset(new Request("http://localhost/empty.txt"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
});
