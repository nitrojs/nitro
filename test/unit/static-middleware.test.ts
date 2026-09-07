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

    expect(() => handler(event)).toThrow("404");
    expect(event.res.headers.get("Vary")).toBe("Origin");
    expect(event.res.headers.get("Cache-Control")).toBeNull();
  });

  it("responds with 404 when a matched asset has no data behind it", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/favicon.ico"
        ? { etag: '"test"', mtime: Date.now(), type: "image/x-icon", size: 1 }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue(undefined);
    const event = createEvent("/favicon.ico");

    await expect(handler(event)).rejects.toThrow("404");
    expect(event.res.headers.get("Cache-Control")).toBeNull();
  });

  // The `inline` reader hands back its payload without a promise.
  it("responds with 404 when a synchronous reader has no data", () => {
    getAsset.mockImplementation((id: string) =>
      id === "/favicon.ico"
        ? { etag: '"test"', mtime: Date.now(), type: "image/x-icon", size: 1 }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockReturnValue(undefined);
    const event = createEvent("/favicon.ico");

    expect(() => handler(event)).toThrow("404");
    expect(event.res.headers.get("Cache-Control")).toBeNull();
  });

  it("propagates reader errors", async () => {
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

  it("serves an empty asset instead of treating it as missing", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/empty.txt"
        ? { etag: '"test"', mtime: Date.now(), type: "text/plain", size: 0 }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue(new Uint8Array());
    const event = createEvent("/empty.txt");

    await expect(handler(event)).resolves.toEqual(new Uint8Array());
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

  it("matches compressed assets when accept-encoding has quality values", async () => {
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
    const event = createEvent("/foo.css", "GZIP; q=1.0, br; q=0.9");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css.gz");
    expect(event.res.headers.get("Content-Encoding")).toBe("gzip");
  });

  it("prefers the encoding with the highest quality value", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/foo.css.gz" || id === "/foo.css.br"
        ? {
            etag: '"test"',
            mtime: Date.now(),
            type: "text/css",
            encoding: id.endsWith(".gz") ? "gzip" : "br",
            size: 1,
          }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "br;q=0.5, gzip;q=1.0");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css.gz");
    expect(event.res.headers.get("Content-Encoding")).toBe("gzip");
  });

  it("keeps the default preference when no quality values are sent", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/foo.css.gz" || id === "/foo.css.br"
        ? {
            etag: '"test"',
            mtime: Date.now(),
            type: "text/css",
            encoding: id.endsWith(".gz") ? "gzip" : "br",
            size: 1,
          }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "gzip, deflate, br, zstd");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css.br");
    expect(event.res.headers.get("Content-Encoding")).toBe("br");
  });

  it("does not match compressed assets with zero quality", async () => {
    getAsset.mockImplementation((id: string) => {
      if (id === "/foo.css.gz") {
        return {
          etag: '"compressed"',
          mtime: "2024-01-01T00:00:00.000Z",
          size: 4,
          type: "text/css",
          encoding: "gzip",
        };
      }
      if (id === "/foo.css") {
        return {
          etag: '"plain"',
          mtime: "2024-01-01T00:00:00.000Z",
          size: 4,
          type: "text/css",
        };
      }
      return undefined;
    });
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "gzip; q=0.0");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css");
    expect(event.res.headers.get("Content-Encoding")).toBeNull();
  });
});
