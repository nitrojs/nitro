import { beforeEach, describe, expect, it, vi } from "vitest";
import { HTTPError, mockEvent } from "h3";
import handler from "../../src/runtime/internal/static.ts";

const MTIME = "2024-01-01T00:00:00.000Z";

const { getAsset, isPublicAssetURL, readAsset } = vi.hoisted(() => ({
  getAsset: vi.fn(),
  isPublicAssetURL: vi.fn(),
  readAsset: vi.fn(),
}));

vi.mock("#nitro/virtual/public-assets", () => ({
  getAsset,
  hasAsset: (id: string) => [id, `${id}.gz`, `${id}.br`, `${id}.zst`].some((i) => getAsset(i)),
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

    expectNoStore(catchError(() => handler(event)));
    expect(event.res.headers.get("Vary")).toBe("Origin");
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

    expectNoStore(await (handler(event) as Promise<unknown>).catch((error) => error));
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

    expectNoStore(catchError(() => handler(event)));
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

  it("ignores byte ranges on an empty asset", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/empty.txt"
        ? { etag: '"test"', mtime: MTIME, type: "text/plain", size: 0 }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue(new Uint8Array());
    const event = createEvent("/empty.txt");
    event.req.headers.set("range", "bytes=-1");

    await expect(handler(event)).resolves.toEqual(new Uint8Array());
    expect(event.res.status).not.toBe(206);
    expect(event.res.headers.get("Content-Range")).toBeNull();
  });

  it("serves a compressed asset whole for a byte range request", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/foo.css.gz"
        ? { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "gzip", size: 4 }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "gzip");
    event.req.headers.set("range", "bytes=0-1");

    await expect(handler(event)).resolves.toBe("body");
    expect(readAsset).toHaveBeenCalledWith("/foo.css.gz");
    expect(event.res.status).not.toBe(206);
    expect(event.res.headers.get("Content-Encoding")).toBe("gzip");
    expect(event.res.headers.get("Content-Range")).toBeNull();
  });

  describe("byte ranges", () => {
    const file = new TextEncoder().encode("0123456789");

    function rangeEvent(headers: Record<string, string>, method = "GET", etag = '"v1"') {
      getAsset.mockImplementation((id: string) =>
        id === "/file.bin"
          ? { etag, mtime: MTIME, type: "application/octet-stream", size: file.length }
          : undefined
      );
      isPublicAssetURL.mockReturnValue(true);
      readAsset.mockReturnValue(file);
      const event = mockEvent("http://localhost/file.bin", { method, headers });
      event.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return event;
    }

    it.each([
      ["bytes=2-4", 2, 4],
      ["bytes=7-", 7, 9],
      ["bytes=-3", 7, 9],
      ["bytes=5-100", 5, 9],
      ["bytes=-100", 0, 9],
    ])("serves %s", async (range, start, end) => {
      const event = rangeEvent({ range });

      expect(await handler(event)).toEqual(file.subarray(start, end + 1));
      expect(event.res.status).toBe(206);
      expect(readAsset).toHaveBeenCalledWith("/file.bin", { start, end });
      expect(event.res.headers.get("Content-Range")).toBe(`bytes ${start}-${end}/10`);
      expect(event.res.headers.get("Content-Length")).toBe(String(end - start + 1));
    });

    it("uses the bytes of a reader that returns only the range", async () => {
      const event = rangeEvent({ range: "bytes=2-4" });
      readAsset.mockResolvedValue(file.subarray(2, 5));

      expect(await handler(event)).toEqual(file.subarray(2, 5));
      expect(event.res.status).toBe(206);
    });

    it.each(["bytes=10-", "bytes=-0"])("responds 416 without caching for %s", (range) => {
      const error = catchError(() => handler(rangeEvent({ range })));

      expectNoStore(error, 416);
      expect((error as HTTPError).headers?.get("Content-Range")).toBe("bytes */10");
    });

    it.each([
      ["a reversed range", { range: "bytes=5-2" }],
      ["multiple ranges", { range: "bytes=0-1,4-5" }],
      ["a mismatched If-Range", { range: "bytes=2-4", "if-range": '"v0"' }],
      ["a weak If-Range", { range: "bytes=2-4", "if-range": 'W/"v1"' }, 'W/"v1"'],
    ])("serves the full asset for %s", async (_, headers, etag?: string) => {
      const event = rangeEvent(headers, "GET", etag);

      expect(await handler(event)).toEqual(file);
      expect(event.res.status).not.toBe(206);
      expect(event.res.headers.get("Content-Length")).toBe("10");
      expect(event.res.headers.get("Content-Range")).toBeNull();
    });

    it("serves a range for a matching If-Range", async () => {
      const event = rangeEvent({ range: "bytes=2-4", "if-range": '"v1"' });

      expect(await handler(event)).toEqual(file.subarray(2, 5));
      expect(event.res.status).toBe(206);
    });

    it("ignores ranges for HEAD requests", async () => {
      const event = rangeEvent({ range: "bytes=2-4" }, "HEAD");

      await handler(event);
      expect(event.res.status).not.toBe(206);
      expect(event.res.headers.get("Content-Length")).toBe("10");
    });

    it("passes through a stream of the range", async () => {
      const event = rangeEvent({ range: "bytes=2-4" });
      const stream = new Blob([file.subarray(2, 5)]).stream();
      readAsset.mockResolvedValue(stream);

      expect(await handler(event)).toBe(stream);
      expect(event.res.status).toBe(206);
      expect(event.res.headers.get("Content-Length")).toBe("3");
    });

    it("keeps validators and Accept-Ranges on a 206", async () => {
      const event = rangeEvent({ range: "bytes=2-4" });

      await handler(event);
      expect(event.res.headers.get("Accept-Ranges")).toBe("bytes");
      expect(event.res.headers.get("ETag")).toBe('"v1"');
      expect(event.res.headers.get("Last-Modified")).toBe(new Date(MTIME).toUTCString());
    });

    it("prefers a matching If-None-Match over the range", async () => {
      const event = rangeEvent({ range: "bytes=2-4", "if-none-match": '"v1"' });

      expect(await handler(event)).toBe("");
      expect(event.res.status).toBe(304);
      expect(readAsset).not.toHaveBeenCalled();
    });

    it("responds 404 without caching when the file is gone", async () => {
      const event = rangeEvent({ range: "bytes=2-4" });
      readAsset.mockResolvedValue(undefined);

      expectNoStore(await (handler(event) as Promise<unknown>).catch((error) => error));
    });
  });

  it("skips requests for paths that are not public assets", () => {
    getAsset.mockReturnValue(undefined);
    isPublicAssetURL.mockReturnValue(false);
    const event = createEvent("/api/hello", "gzip, br");
    const getHeader = vi.spyOn(event.req.headers, "get");

    expect(handler(event)).toBeUndefined();
    expect(getHeader).not.toHaveBeenCalledWith("accept-encoding");
    expect(getAsset).toHaveBeenCalledWith("/api/hello");
    expect(getAsset).toHaveBeenCalledWith("/api/hello/index.html");
    expect(readAsset).not.toHaveBeenCalled();
    expect(event.res.headers.get("Vary")).toBe("Origin");
  });

  it("serves assets that only exist compressed outside of public asset bases", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/docs/index.html.br"
        ? { etag: '"test"', mtime: MTIME, type: "text/html", encoding: "br", size: 1 }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(false);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/docs/", "br");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/docs/index.html.br");
    expect(event.res.headers.get("Content-Encoding")).toBe("br");
  });

  it("appends Accept-Encoding vary when a compressed asset is matched", async () => {
    getAsset.mockImplementation((id: string) => {
      if (id === "/foo.css.gz") {
        return {
          etag: '"test"',
          mtime: MTIME,
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

  // Both `gzip` and `q` are case-insensitive, and both have to be recognised
  // for `.gz` to outrank the alphabetically-earlier `.br`.
  it("matches compressed assets when the encoding name and q key differ in case", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/foo.css.gz" || id === "/foo.css.br"
        ? {
            etag: '"test"',
            mtime: MTIME,
            type: "text/css",
            encoding: id.endsWith(".gz") ? "gzip" : "br",
            size: 1,
          }
        : undefined
    );
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "GZIP; q=1.0, br; Q=0.9");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css.gz");
    expect(event.res.headers.get("Content-Encoding")).toBe("gzip");
  });

  it("prefers the encoding with the highest quality value", async () => {
    getAsset.mockImplementation((id: string) =>
      id === "/foo.css.gz" || id === "/foo.css.br"
        ? {
            etag: '"test"',
            mtime: MTIME,
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
            mtime: MTIME,
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
          mtime: MTIME,
          size: 4,
          type: "text/css",
          encoding: "gzip",
        };
      }
      if (id === "/foo.css") {
        return {
          etag: '"plain"',
          mtime: MTIME,
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

function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
}

// Missing assets opt out of the immutable `cache-control` route rule (h3js/h3#1612)
function expectNoStore(error: unknown, status = 404) {
  expect(error).toBeInstanceOf(HTTPError);
  expect((error as HTTPError).status).toBe(status);
  expect((error as HTTPError).headers?.get("cache-control")).toBe("no-store");
}
