import { type HTTPMethod, createError, eventHandler } from "h3";
import type { PublicAsset } from "nitro/types";
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

  const encodingHeader = event.request.headers.get("accept-encoding") || "";
  const encodings = [
    ...encodingHeader
      .split(",")
      .map((e) => EncodingMap[e.trim() as keyof typeof EncodingMap])
      .filter(Boolean)
      .sort(),
    "",
  ];
  if (encodings.length > 1) {
    event.response.headers.append("Vary", "Accept-Encoding");
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
      event.response.headers.delete("Cache-Control");
      throw createError({
        statusMessage: "Cannot find static asset " + id,
        statusCode: 404,
      });
    }
    return;
  }

  const ifNotMatch = event.headers.get("if-none-match") === asset.etag;
  if (ifNotMatch) {
    event.response.status = 304;
    event.response.statusText = "Not Modified";
    return "";
  }

  const ifModifiedSinceH = event.headers.get("if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (
    ifModifiedSinceH &&
    asset.mtime &&
    new Date(ifModifiedSinceH) >= mtimeDate
  ) {
    event.response.status = 304;
    event.response.statusText = "Not Modified";
    return "";
  }

  if (asset.type) {
    event.response.headers.set("Content-Type", asset.type);
  }

  if (asset.etag && !event.response.headers.has("ETag")) {
    event.response.headers.set("ETag", asset.etag);
  }

  if (asset.mtime && !event.response.headers.has("Last-Modified")) {
    event.response.headers.set("Last-Modified", mtimeDate.toUTCString());
  }

  if (asset.encoding && !event.response.headers.has("Content-Encoding")) {
    event.response.headers.set("Content-Encoding", asset.encoding);
  }

  if (asset.size > 0 && !event.response.headers.has("Content-Length")) {
    event.response.headers.set("Content-Length", asset.size.toString());
  }

  return readAsset(id);
});
