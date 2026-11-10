import { beforeEach, describe, expect, it, vi } from "vitest";
import { HTTPError, mockEvent, toResponse } from "h3";
import handler from "../../src/runtime/internal/static.ts";
import { loadPublicAssets } from "./_public-assets.ts";
import type { PublicAssetsLookup } from "./_public-assets.ts";

const MTIME = "2024-01-01T00:00:00.000Z";

// Manifest lookups run the generated template; public asset bases and reads are mocked
const { lookup, isPublicAssetURL, readAsset } = vi.hoisted(() => ({
  lookup: {} as { current?: PublicAssetsLookup },
  isPublicAssetURL: vi.fn(),
  readAsset: vi.fn(),
}));

vi.mock("#nitro/virtual/public-assets", () => ({
  getAsset: (id: string) => lookup.current!.getAsset(id),
  hasAsset: (id: string) => lookup.current!.hasAsset(id),
  resolveAsset: (id: string, encodings: string[]) => lookup.current!.resolveAsset(id, encodings),
  hasEncodedVariants: (id: string) => lookup.current!.hasEncodedVariants(id),
  isPublicAssetURL,
  isPublicAssetBaseURL: (id: string) => isPublicAssetURL(id),
  readAsset,
}));

function setAssets(assets: Record<string, object>) {
  lookup.current = loadPublicAssets(assets);
}

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
    setAssets({});
    isPublicAssetURL.mockReset();
    readAsset.mockReset();
  });

  it("does not append Accept-Encoding vary when no asset is matched", async () => {
    setAssets({});
    isPublicAssetURL.mockReturnValue(true);
    const event = createEvent("/foo-missing.css", "gzip");

    expectNoStore(catchError(() => handler(event)));
    expect(event.res.headers.get("Vary")).toBe("Origin");
  });

  it("responds with 404 when a matched asset has no data behind it", async () => {
    setAssets({
      "/favicon.ico": { etag: '"test"', mtime: Date.now(), type: "image/x-icon", size: 1 },
    });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue(undefined);
    const event = createEvent("/favicon.ico");

    expectNoStore(await (handler(event) as Promise<unknown>).catch((error) => error));
  });

  // The `inline` reader hands back its payload without a promise.
  it("responds with 404 when a synchronous reader has no data", () => {
    setAssets({
      "/favicon.ico": { etag: '"test"', mtime: Date.now(), type: "image/x-icon", size: 1 },
    });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockReturnValue(undefined);
    const event = createEvent("/favicon.ico");

    expectNoStore(catchError(() => handler(event)));
  });

  it("propagates reader errors", async () => {
    setAssets({
      "/favicon.ico": { etag: '"test"', mtime: Date.now(), type: "image/x-icon", size: 1 },
    });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));
    const event = createEvent("/favicon.ico");

    await expect(handler(event)).rejects.toThrow("EACCES");
  });

  it("serves an empty asset instead of treating it as missing", async () => {
    setAssets({ "/empty.txt": { etag: '"test"', mtime: Date.now(), type: "text/plain", size: 0 } });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue(new Uint8Array());
    const event = createEvent("/empty.txt");

    await expect(handler(event)).resolves.toEqual(new Uint8Array());
  });

  it("ignores byte ranges on an empty asset", async () => {
    setAssets({ "/empty.txt": { etag: '"test"', mtime: MTIME, type: "text/plain", size: 0 } });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue(new Uint8Array());
    const event = createEvent("/empty.txt");
    event.req.headers.set("range", "bytes=-1");

    await expect(handler(event)).resolves.toEqual(new Uint8Array());
    expect(event.res.status).not.toBe(206);
    expect(event.res.headers.get("Content-Range")).toBeNull();
  });

  it("serves a compressed asset whole for a byte range request", async () => {
    setAssets({
      "/foo.css.gz": { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "gzip", size: 4 },
    });
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
      setAssets({
        "/file.bin": { etag, mtime: MTIME, type: "application/octet-stream", size: file.length },
      });
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
      ["Bytes=2-4", 2, 4],
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
    setAssets({});
    isPublicAssetURL.mockReturnValue(false);
    const event = createEvent("/api/hello", "gzip, br");
    const getHeader = vi.spyOn(event.req.headers, "get");

    expect(handler(event)).toBeUndefined();
    expect(getHeader).not.toHaveBeenCalledWith("accept-encoding");
    expect(readAsset).not.toHaveBeenCalled();
    expect(event.res.headers.get("Vary")).toBe("Origin");
  });

  it("serves assets that only exist compressed outside of public asset bases", async () => {
    setAssets({
      "/docs/index.html.br": {
        etag: '"test"',
        mtime: MTIME,
        type: "text/html",
        encoding: "br",
        size: 1,
      },
    });
    isPublicAssetURL.mockReturnValue(false);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/docs/", "br");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/docs/index.html.br");
    expect(event.res.headers.get("Content-Encoding")).toBe("br");
  });

  it("appends Accept-Encoding vary when a compressed asset is matched", async () => {
    setAssets({
      "/foo.css.gz": { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "gzip", size: 1 },
    });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "gzip");

    await handler(event);

    expect(event.res.headers.get("Vary")).toContain("Origin");
    expect(event.res.headers.get("Vary")).toContain("Accept-Encoding");
  });

  describe("Vary: Accept-Encoding", () => {
    const meta = { etag: '"test"', mtime: MTIME, type: "text/css", size: 1 };

    beforeEach(() => {
      isPublicAssetURL.mockReturnValue(true);
      readAsset.mockResolvedValue("body");
    });

    it.each(["", "gzip;q=0", "identity", "gzip, br"])(
      "is sent for an asset with compressed variants (Accept-Encoding: %j)",
      async (acceptEncoding) => {
        setAssets({ "/foo.css": meta, "/foo.css.br": { ...meta, encoding: "br" } });
        const event = createEvent("/foo.css", acceptEncoding);

        await handler(event);

        expect(event.res.headers.get("Vary")).toBe("Origin, Accept-Encoding");
      }
    );

    it("is sent for an index.html with compressed variants", async () => {
      setAssets({ "/docs/index.html": meta, "/docs/index.html.gz": { ...meta, encoding: "gzip" } });
      const event = createEvent("/docs");

      await handler(event);

      expect(readAsset).toHaveBeenCalledWith("/docs/index.html");
      expect(event.res.headers.get("Vary")).toBe("Origin, Accept-Encoding");
    });

    it("is sent on a 304", async () => {
      setAssets({ "/foo.css": meta, "/foo.css.gz": { ...meta, encoding: "gzip" } });
      const event = createEvent("/foo.css");
      event.req.headers.set("if-none-match", '"test"');

      expect(await handler(event)).toBe("");
      expect(event.res.status).toBe(304);
      expect(event.res.headers.get("Vary")).toBe("Origin, Accept-Encoding");
    });

    it("is sent on a 206", async () => {
      setAssets({
        "/foo.css": { ...meta, size: 4 },
        "/foo.css.gz": { ...meta, encoding: "gzip" },
      });
      readAsset.mockResolvedValue(new TextEncoder().encode("body"));
      const event = createEvent("/foo.css");
      event.req.headers.set("range", "bytes=0-1");

      await handler(event);

      expect(event.res.status).toBe(206);
      expect(event.res.headers.get("Vary")).toBe("Origin, Accept-Encoding");
    });

    it.each(["gzip, br", "br"])(
      "is not sent for an asset without compressed variants (Accept-Encoding: %j)",
      async (acceptEncoding) => {
        setAssets({ "/foo.css": meta });
        const event = createEvent("/foo.css", acceptEncoding);

        await handler(event);

        expect(event.res.headers.get("Vary")).toBe("Origin");
      }
    );

    it("is not sent for a compressed file requested by its own name", async () => {
      setAssets({ "/foo.css": meta, "/foo.css.br": { ...meta, encoding: "br" } });
      const event = createEvent("/foo.css.br", "br");

      await handler(event);

      expect(readAsset).toHaveBeenCalledWith("/foo.css.br");
      expect(event.res.headers.get("Vary")).toBe("Origin");
    });

    it("is sent on the 404 of a compressed-only asset", async () => {
      setAssets({ "/foo.css.br": { ...meta, encoding: "br" } });
      const event = createEvent("/foo.css", "gzip");
      // As staged by a CORS route rule
      event.res.errHeaders.append("Vary", "Origin");
      const error = catchError(() => handler(event));

      expectNoStore(error);
      const res = await toResponse(error as HTTPError, event);
      expect(res.status).toBe(404);
      expect(res.headers.get("Vary")).toBe("Origin, Accept-Encoding");
    });

    it("is sent on a 412", async () => {
      setAssets({ "/foo.css": meta, "/foo.css.gz": { ...meta, encoding: "gzip" } });
      const event = createEvent("/foo.css");
      event.req.headers.set("if-match", '"stale"');
      const error = catchError(() => handler(event));

      expectNoStore(error, 412);
      const res = await toResponse(error as HTTPError, event);
      expect(res.headers.get("Vary")).toBe("Accept-Encoding");
    });

    it("is sent when a compressed-only asset falls through to the app", () => {
      setAssets({ "/docs/index.html.br": { ...meta, encoding: "br" } });
      isPublicAssetURL.mockReturnValue(false);
      const event = createEvent("/docs/");

      expect(handler(event)).toBeUndefined();
      expect(readAsset).not.toHaveBeenCalled();
      expect(event.res.headers.get("Vary")).toBe("Origin, Accept-Encoding");
    });
  });

  // Both `gzip` and `q` are case-insensitive, and both have to be recognised
  // for `.gz` to outrank the alphabetically-earlier `.br`.
  it("matches compressed assets when the encoding name and q key differ in case", async () => {
    setAssets({
      "/foo.css.gz": { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "gzip", size: 1 },
      "/foo.css.br": { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "br", size: 1 },
    });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "GZIP; q=1.0, br; Q=0.9");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css.gz");
    expect(event.res.headers.get("Content-Encoding")).toBe("gzip");
  });

  it("prefers the encoding with the highest quality value", async () => {
    setAssets({
      "/foo.css.gz": { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "gzip", size: 1 },
      "/foo.css.br": { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "br", size: 1 },
    });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "br;q=0.5, gzip;q=1.0");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css.gz");
    expect(event.res.headers.get("Content-Encoding")).toBe("gzip");
  });

  it("keeps the default preference when no quality values are sent", async () => {
    setAssets({
      "/foo.css.gz": { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "gzip", size: 1 },
      "/foo.css.br": { etag: '"test"', mtime: MTIME, type: "text/css", encoding: "br", size: 1 },
    });
    isPublicAssetURL.mockReturnValue(true);
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "gzip, deflate, br, zstd");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css.br");
    expect(event.res.headers.get("Content-Encoding")).toBe("br");
  });

  it("does not match compressed assets with zero quality", async () => {
    setAssets({
      "/foo.css.gz": {
        etag: '"compressed"',
        mtime: MTIME,
        size: 4,
        type: "text/css",
        encoding: "gzip",
      },
      "/foo.css": { etag: '"plain"', mtime: MTIME, size: 4, type: "text/css" },
    });
    readAsset.mockResolvedValue("body");
    const event = createEvent("/foo.css", "gzip; q=0.0");

    await handler(event);

    expect(readAsset).toHaveBeenCalledWith("/foo.css");
    expect(event.res.headers.get("Content-Encoding")).toBeNull();
  });

  // Parsed `Accept-Encoding` values are cached with a bounded size
  it("negotiates each Accept-Encoding value on its own", async () => {
    setAssets({
      "/foo.css": { etag: '"plain"', mtime: MTIME, type: "text/css", size: 1 },
      "/foo.css.gz": { etag: '"gz"', mtime: MTIME, type: "text/css", encoding: "gzip", size: 1 },
      "/foo.css.br": { etag: '"br"', mtime: MTIME, type: "text/css", encoding: "br", size: 1 },
    });
    readAsset.mockReturnValue("body");
    const servedFor = (acceptEncoding: string) => {
      handler(createEvent("/foo.css", acceptEncoding));
      return readAsset.mock.lastCall?.[0];
    };

    for (let i = 0; i < 100; i++) {
      expect(servedFor(`br;q=0.5, gzip, x-${i}`)).toBe("/foo.css.gz");
    }
    expect(servedFor("gzip;q=0")).toBe("/foo.css");
    expect(servedFor("br;q=0.5, gzip, x-0")).toBe("/foo.css.gz");
    const long = `${"x-padding, ".repeat(30)}br`;
    expect(servedFor(long)).toBe("/foo.css.br");
    expect(servedFor(long)).toBe("/foo.css.br");
  });

  it("sends the same Last-Modified on repeated hits", () => {
    setAssets({ "/foo.css": { etag: '"plain"', mtime: MTIME, type: "text/css", size: 1 } });
    readAsset.mockReturnValue("body");

    for (let i = 0; i < 2; i++) {
      const event = createEvent("/foo.css");
      handler(event);
      expect(event.res.headers.get("Last-Modified")).toBe(new Date(MTIME).toUTCString());
    }
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
