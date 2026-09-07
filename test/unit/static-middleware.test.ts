import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockEvent } from "h3";
import handler from "../../src/runtime/internal/static.ts";

const { getAsset, isPublicAssetURL, readAsset } = vi.hoisted(() => ({
  getAsset: vi.fn(),
  isPublicAssetURL: vi.fn(),
  readAsset: vi.fn(),
}));

vi.mock("#nitro/virtual/public-assets", () => ({
  getAsset,
  isPublicAssetURL,
  readAsset,
}));

function createEvent(pathname: string, acceptEncoding = "") {
  const event = mockEvent(`http://localhost${pathname}`, {
    headers: acceptEncoding ? { "accept-encoding": acceptEncoding } : undefined,
  });
  event.res.headers.set("Vary", "Origin");
  event.res.headers.set("Cache-Control", "max-age=3600");
  return event;
}

describe("runtime static middleware", () => {
  beforeEach(() => {
    getAsset.mockReset();
    isPublicAssetURL.mockReset();
    readAsset.mockReset();
  });

  it("does not append Accept-Encoding vary when no asset is matched", async () => {
    getAsset.mockReturnValue(undefined);
    isPublicAssetURL.mockReturnValue(true);
    const event = createEvent("/foo-missing.css", "gzip");

    await expect(handler(event)).rejects.toThrow("404");
    expect(event.res.headers.get("Vary")).toBe("Origin");
    expect(event.res.headers.get("Cache-Control")).toBeNull();
  });

  it("responds with 404 when a matched asset is missing on disk", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/favicon.ico"
        ? { etag: '"test"', mtime: Date.now(), type: "image/x-icon", size: 1 }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" })
    );
    const event = createEvent("/favicon.ico");

    await expect(handler(event)).rejects.toThrow("404");
    expect(event.res.headers.get("Cache-Control")).toBeNull();
    expect(event.res.headers.get("Content-Type")).toBeNull();
    expect(event.res.headers.get("ETag")).toBeNull();
  });

  it("rethrows non-ENOENT read errors", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/favicon.ico"
        ? { etag: '"test"', mtime: Date.now(), type: "image/x-icon", size: 1 }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    const event = createEvent("/favicon.ico");

    await expect(handler(event)).rejects.toThrow("EACCES");
  });

  it("appends Accept-Encoding vary when a compressed asset is matched", async () => {
    getAsset.mockImplementation((id: string) => {
      if (id === "/foo.css.gz") {
        return {
          etag: '"test"',
          mtime: Date.now(),
          type: "text/css",
          encoding: "gzip",
          size: 1,
        };
      }
      return undefined;
    });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "gzip");

    await handler(event);

    expect(event.res.headers.get("Vary")).toContain("Origin");
    expect(event.res.headers.get("Vary")).toContain("Accept-Encoding");
  });
});
