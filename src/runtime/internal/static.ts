import { HTTPError, defineHandler } from "h3";
import type { EventHandler, HTTPMethod } from "h3";
import type { PublicAsset } from "nitro/types";
import { decodePath, withLeadingSlash, withoutTrailingSlash } from "ufo";
import {
  getAsset,
  hasAsset,
  hasEncodedVariants,
  isPublicAssetBaseURL,
  isPublicAssetURL,
  readAsset,
  resolveAsset,
} from "#nitro/virtual/public-assets";

const METHODS = new Set(["HEAD", "GET"] as HTTPMethod[]);

// Must match `_exts` of the `#nitro/virtual/public-assets` template: others are never served
const EncodingMap = { gzip: ".gz", br: ".br", zstd: ".zst" } as const;
const EncodingExtensions = Object.values(EncodingMap);

// Clients send only a few distinct `Accept-Encoding` values
const encodingsCache = new Map<string, readonly string[]>();

// Opts missing assets out of the immutable `cache-control` route rule of asset dirs (h3js/h3#1612)
const noCacheHeaders = { "cache-control": "no-store" };

type CachedAsset = PublicAsset & { _lastModified?: string };

// Range units are case-insensitive (RFC 9110 14.1)
const RANGE_RE = /^bytes=(\d*)-(\d*)$/i;

export default defineHandler((event) => {
  if (event.req.method && !METHODS.has(event.req.method as HTTPMethod)) {
    return;
  }

  const path = withLeadingSlash(withoutTrailingSlash(event.url.pathname));
  let id = path.includes("%") ? decodePath(path) : path;

  // Most requests are not for public assets: skip the encoding negotiation for them
  if (!hasAsset(id) && !isPublicAssetBaseURL(id)) {
    return;
  }

  const encodings = getEncodings(event.req.headers.get("accept-encoding") || "");
  const assetId = resolveAsset(id, encodings);
  const asset = assetId ? getAsset(assetId) : undefined;

  // The selection depends on `Accept-Encoding` whenever compressed files exist (RFC 9110 12.5.5)
  const vary = hasEncodedVariants(id);
  if (vary) {
    event.res.headers.append("Vary", "Accept-Encoding");
    event.res.errHeaders.append("Vary", "Accept-Encoding");
  }

  if (!asset) {
    if (hasAsset(id) && !encodings.includes("")) {
      throw new HTTPError({ status: 406, headers: noCacheHeaders });
    }
    if (isPublicAssetURL(id)) {
      throw new HTTPError({ status: 404, headers: noCacheHeaders });
    }
    return;
  }
  id = assetId!;

  if (asset.etag && !event.res.headers.has("ETag")) {
    event.res.headers.set("ETag", asset.etag);
  }

  if (asset.mtime && !event.res.headers.has("Last-Modified")) {
    event.res.headers.set(
      "Last-Modified",
      ((asset as CachedAsset)._lastModified ??= new Date(asset.mtime).toUTCString())
    );
  }

  const precondition = evaluatePreconditions(event.req.headers, asset);
  if (precondition === 412) {
    throw new HTTPError({ status: 412, headers: noCacheHeaders });
  }
  if (precondition === 304) {
    event.res.status = 304;
    event.res.statusText = "Not Modified";
    return "";
  }

  if (asset.type) {
    event.res.headers.set("Content-Type", asset.type);
  }

  if (asset.encoding && !event.res.headers.has("Content-Encoding")) {
    event.res.headers.set("Content-Encoding", asset.encoding);
  }

  let range: ByteRange | "unsatisfiable" | undefined;
  if (!asset.encoding && asset.size > 0) {
    event.res.headers.set("Accept-Ranges", "bytes");
    // `If-Range` needs a strong validator match (RFC 9110 13.1.5)
    const ifRange = event.req.headers.get("if-range");
    if (
      event.req.method === "GET" &&
      (!ifRange || (ifRange === asset.etag && !ifRange.startsWith("W/")))
    ) {
      range = parseRange(event.req.headers.get("range") || "", asset.size);
    }
  }

  if (range === "unsatisfiable") {
    throw new HTTPError({
      status: 416,
      headers: { ...noCacheHeaders, "Content-Range": `bytes */${asset.size}` },
    });
  }

  if (asset.size > 0 && !event.res.headers.has("Content-Length")) {
    event.res.headers.set("Content-Length", asset.size.toString());
  }

  const toBody = (data: unknown) => {
    assertAssetData(data);
    if (!range) {
      return data;
    }
    const length = range.end - range.start + 1;
    event.res.status = 206;
    event.res.headers.set("Content-Range", `bytes ${range.start}-${range.end}/${asset.size}`);
    event.res.headers.set("Content-Length", length.toString());
    // Readers return either the requested range (node stream) or the full asset bytes (inline)
    return data instanceof Uint8Array && data.byteLength > length
      ? data.subarray(range.start, range.end + 1)
      : data;
  };
  const data = range ? readAsset(id, range) : readAsset(id);
  return typeof (data as { then?: unknown })?.then === "function"
    ? (data as Promise<unknown>).then(toBody)
    : toBody(data);
}) as EventHandler;

// Readers resolve with `null`/`undefined` when the manifest entry has no data
// backing it (file removed after build, missing inline payload).
function assertAssetData<T>(data: T): T {
  if (data === null || data === undefined) {
    throw new HTTPError({ status: 404, headers: noCacheHeaders });
  }
  return data;
}

// Precedence of RFC 9110 13.2.2 for GET and HEAD
function evaluatePreconditions(headers: Headers, asset: PublicAsset): 304 | 412 | undefined {
  const ifMatch = headers.get("if-match");
  if (
    ifMatch === null
      ? isModifiedSince(asset.mtime, headers.get("if-unmodified-since"))
      : !matchesETag(ifMatch, asset.etag, true)
  ) {
    return 412;
  }
  const ifNoneMatch = headers.get("if-none-match");
  if (
    ifNoneMatch === null
      ? isModifiedSince(asset.mtime, headers.get("if-modified-since")) === false
      : matchesETag(ifNoneMatch, asset.etag, false)
  ) {
    return 304;
  }
}

// Strong comparison for `If-Match`, weak for `If-None-Match` (RFC 9110 8.8.3.2)
function matchesETag(header: string, etag: string, strong: boolean): boolean {
  if (header.trim() === "*") {
    return true;
  }
  if (!etag || (strong && etag.startsWith("W/"))) {
    return false;
  }
  const opaque = etag.replace(/^W\//, "");
  return header.split(",").some((candidate) => {
    candidate = candidate.trim();
    return strong ? candidate === etag : candidate.replace(/^W\//, "") === opaque;
  });
}

// `undefined` for a missing or invalid date; HTTP dates have a one second resolution
function isModifiedSince(mtime: string, header: string | null): boolean | undefined {
  if (!header) {
    return;
  }
  const since = Date.parse(header);
  const modified = Date.parse(mtime);
  if (Number.isNaN(since) || Number.isNaN(modified)) {
    return;
  }
  return Math.floor(modified / 1000) * 1000 > since;
}

// Accepted encoding extensions, most preferred first (omitting `identity` when explicitly rejected)
function getEncodings(header: string): readonly string[] {
  let encodings = encodingsCache.get(header);
  if (!encodings) {
    encodings = parseAcceptEncoding(header);
    if (header.length > 256) {
      return encodings;
    }
    if (encodingsCache.size >= 64) {
      encodingsCache.delete(encodingsCache.keys().next().value!);
    }
    encodingsCache.set(header, encodings);
  }
  return encodings;
}

function parseAcceptEncoding(header: string): string[] {
  let wildcardWeight: number | undefined;
  let identityWeight: number | undefined;
  const explicitWeights = new Map<string, number>();

  for (const entry of header.split(",")) {
    const [rawName, ...parameters] = entry.split(";");
    const name = rawName.trim().toLowerCase();
    if (!name) {
      continue;
    }
    const quality = parameters
      .map((parameter) => parameter.trim().split("="))
      .find(([key]) => key.toLowerCase() === "q")?.[1];
    const parsed = quality === undefined ? 1 : Number.parseFloat(quality);
    // An unparsable weight is an invalid parameter, not a rejection
    const weight = Number.isNaN(parsed) ? 1 : parsed;

    if (name === "*") {
      wildcardWeight = weight;
    } else if (name === "identity") {
      identityWeight = weight;
    } else {
      const ext = EncodingMap[name as keyof typeof EncodingMap];
      if (ext) {
        explicitWeights.set(ext, weight);
      }
    }
  }

  const candidates: Array<{ ext: string; weight: number }> = [];
  for (const ext of EncodingExtensions) {
    const weight = explicitWeights.get(ext) ?? wildcardWeight ?? 0;
    if (weight > 0) {
      candidates.push({ ext, weight });
    }
  }

  // `identity` stays acceptable unless excluded explicitly or via `*` (RFC 9110 12.5.3)
  const resolvedIdentity = identityWeight ?? wildcardWeight;
  if (resolvedIdentity === undefined) {
    // Implicit fallback sorts strictly behind every positively weighted coding
    candidates.push({ ext: "", weight: 0 });
  } else if (resolvedIdentity > 0) {
    candidates.push({ ext: "", weight: resolvedIdentity });
  }

  // Highest client weight wins; at equal weight, prefer compressed codings over `identity` in server order
  return candidates
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      if (a.ext === b.ext) {
        return 0;
      }
      if (a.ext === "") {
        return 1;
      }
      if (b.ext === "") {
        return -1;
      }
      return a.ext < b.ext ? -1 : 1;
    })
    .map((entry) => entry.ext);
}

type ByteRange = { start: number; end: number };

// A single `bytes=` range (RFC 9110 14.1.2), like srvx's `staticMiddleware`; others serve the full asset
function parseRange(header: string, size: number): ByteRange | "unsatisfiable" | undefined {
  const match = RANGE_RE.exec(header);
  if (!match || size === 0) {
    return;
  }
  const [, startStr, endStr] = match;
  if (!startStr) {
    if (!endStr) {
      return;
    }
    const suffix = Number(endStr);
    if (suffix === 0) {
      return "unsatisfiable";
    }
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }
  const start = Number(startStr);
  if (endStr && Number(endStr) < start) {
    return;
  }
  if (start >= size) {
    return "unsatisfiable";
  }
  const end = endStr ? Math.min(Number(endStr), size - 1) : size - 1;
  return { start, end };
}
