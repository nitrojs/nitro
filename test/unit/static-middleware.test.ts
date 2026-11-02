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
function expectNoStore(error: unknown) {
  expect(error).toBeInstanceOf(HTTPError);
  expect((error as HTTPError).status).toBe(404);
  expect((error as HTTPError).headers?.get("cache-control")).toBe("no-store");
}
