import { HTTPError, defineHandler } from "h3";
import type { EventHandler, HTTPMethod } from "h3";
import type { PublicAsset } from "nitro/types";
import { decodePath, joinURL, withLeadingSlash, withoutTrailingSlash } from "ufo";
import { getAsset, isPublicAssetURL, readAsset } from "#nitro/virtual/public-assets";

const METHODS = new Set(["HEAD", "GET"] as HTTPMethod[]);

const EncodingMap = { gzip: ".gz", br: ".br" } as const;

export default defineHandler((event) => {
  if (event.req.method && !METHODS.has(event.req.method as HTTPMethod)) {
    return;
  }

  let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));

  let asset: PublicAsset | undefined;

  const encodingHeader = event.req.headers.get("accept-encoding") || "";
  const encodings = [
    ...encodingHeader
      .split(",")
      .map((e) => EncodingMap[e.trim() as keyof typeof EncodingMap])
      .filter(Boolean)
      .sort(),
    "",
  ];
  if (encodings.length > 1) {
    event.res.headers.append("Vary", "Accept-Encoding");
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
      event.res.headers.delete("Cache-Control");
      throw new HTTPError({ status: 404 });
    }
    return;
  }

  const ifNotMatch = event.req.headers.get("if-none-match") === asset.etag;
  if (ifNotMatch) {
    event.res.status = 304;
    event.res.statusText = "Not Modified";
    return "";
  }

  const ifModifiedSinceH = event.req.headers.get("if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
    event.res.status = 304;
    event.res.statusText = "Not Modified";
    return "";
  }

  if (asset.type) {
    event.res.headers.set("Content-Type", asset.type);
  }

  if (asset.etag && !event.res.headers.has("ETag")) {
    event.res.headers.set("ETag", asset.etag);
  }

  if (asset.mtime && !event.res.headers.has("Last-Modified")) {
    event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
  }

  if (asset.encoding && !event.res.headers.has("Content-Encoding")) {
    event.res.headers.set("Content-Encoding", asset.encoding);
  }

  if (asset.size > 0 && !event.res.headers.has("Content-Length")) {
    event.res.headers.set("Content-Length", asset.size.toString());
  }

  return readAsset(id);
}) as EventHandler;
