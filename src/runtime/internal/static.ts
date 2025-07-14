import {
  type HTTPMethod,
  createError,
  eventHandler,
  getRequestHeader,
  getResponseHeader,
  removeResponseHeader,
  setResponseHeader,
  appendResponseHeader,
  setResponseStatus,
} from "h3";
import type { PublicAsset } from "nitropack/types";
import {
  decodePath,
  joinURL,
  parseURL,
  withLeadingSlash,
  withoutTrailingSlash,
} from "ufo";
import {
  getAsset,
  isPublicAssetURL,
  readAsset,
} from "#nitro-internal-virtual/public-assets";

const METHODS = new Set(["HEAD", "GET"] as HTTPMethod[]);

const EncodingMap = { gzip: ".gz", br: ".br" } as const;

export default eventHandler((event) => {
  if (event.method && !METHODS.has(event.method)) {
    return;
  }

  let id = decodePath(
    withLeadingSlash(withoutTrailingSlash(parseURL(event.path).pathname))
  );

  let asset: PublicAsset | undefined;

  const encodingHeader = String(
    getRequestHeader(event, "accept-encoding") || ""
  );
  const encodings = [
    ...encodingHeader
      .split(",")
      .map((e) => EncodingMap[e.trim() as keyof typeof EncodingMap])
      .filter(Boolean)
      .sort(),
    "",
  ];
  if (encodings.length > 1) {
    appendResponseHeader(event, "Vary", "Accept-Encoding");
  }

  for (const encoding of encodings) {
    for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
      const _asset = getAsset(_id);
      if (_asset) {
        asset = _asset;
        id = _id;
        break;
      }
    }
  }

  if (!asset) {
    if (isPublicAssetURL(id)) {
      removeResponseHeader(event, "Cache-Control");
      throw createError({ statusCode: 404 });
    }
    return;
  }

  const ifNotMatch = getRequestHeader(event, "if-none-match") === asset.etag;
  if (ifNotMatch) {
    setResponseStatus(event, 304, "Not Modified");
    return "";
  }

  const ifModifiedSinceH = getRequestHeader(event, "if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (
    ifModifiedSinceH &&
    asset.mtime &&
    new Date(ifModifiedSinceH) >= mtimeDate
  ) {
    setResponseStatus(event, 304, "Not Modified");
    return "";
  }

  if (asset.type && !getResponseHeader(event, "Content-Type")) {
    setResponseHeader(event, "Content-Type", asset.type);
  }

  if (asset.etag && !getResponseHeader(event, "ETag")) {
    setResponseHeader(event, "ETag", asset.etag);
  }

  if (asset.mtime && !getResponseHeader(event, "Last-Modified")) {
    setResponseHeader(event, "Last-Modified", mtimeDate.toUTCString());
  }

  if (asset.encoding && !getResponseHeader(event, "Content-Encoding")) {
    setResponseHeader(event, "Content-Encoding", asset.encoding);
  }

  if (asset.size > 0 && !getResponseHeader(event, "Content-Length")) {
    setResponseHeader(event, "Content-Length", asset.size);
  }

  return readAsset(id);
});
