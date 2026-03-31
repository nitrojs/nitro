import { existsSync } from "node:fs";
import fsp from "node:fs/promises";
import zlib from "node:zlib";
import { glob } from "tinyglobby";
import mime from "mime";
import type { Nitro } from "nitro/types";
import { resolve } from "pathe";

const EncodingMap = { gzip: ".gz", br: ".br", zstd: ".zst" } as const;

export async function compressPublicAssets(nitro: Nitro) {
  const publicFiles = await glob("**", {
    cwd: nitro.options.output.publicDir,
    absolute: false,
    dot: true,
    ignore: ["**/*.gz", "**/*.br", "**/*.zst"],
  });

  await Promise.all(
    publicFiles.map(async (fileName) => {
      const compressPublicAssets = nitro.options.compressPublicAssets;
      if (compressPublicAssets === false) {
        return;
      }

      const {
        gzip = false,
        brotli = false,
        zstd = false,
      } = compressPublicAssets === true
        ? { gzip: true, brotli: true, zstd: true }
        : compressPublicAssets;
      const zstdSupported = zlib.zstdCompress !== undefined;
      const filePath = resolve(nitro.options.output.publicDir, fileName);

      if (
        (gzip && existsSync(filePath + EncodingMap.gzip)) ||
        (brotli && existsSync(filePath + EncodingMap.br)) ||
        (zstd && zstdSupported && existsSync(filePath + EncodingMap.zstd))
      ) {
        return;
      }

      const mimeType = mime.getType(fileName) || "text/plain";

      const fileContents = await fsp.readFile(filePath);
      if (
        fileContents.length < 1024 ||
        fileName.endsWith(".map") ||
        !isCompressibleMime(mimeType)
      ) {
        return;
      }

      const encodings = [
        gzip && ("gzip" as const),
        brotli && ("br" as const),
        zstd && zstdSupported && ("zstd" as const),
      ].filter((v): v is keyof typeof EncodingMap => v !== false);

      await Promise.all(
        encodings.map(async (encoding) => {
          const suffix = EncodingMap[encoding];
          const compressedPath = filePath + suffix;
          if (existsSync(compressedPath)) {
            return;
          }
          const brotliOptions = {
            [zlib.constants.BROTLI_PARAM_MODE]: isTextMime(mimeType)
              ? zlib.constants.BROTLI_MODE_TEXT
              : zlib.constants.BROTLI_MODE_GENERIC,
            [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_DEFAULT_QUALITY,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: fileContents.length,
          };
          const compressedBuff: Buffer = await new Promise((resolve, reject) => {
            const cb = (error: Error | null, result: Buffer) =>
              error ? reject(error) : resolve(result);
            if (encoding === "gzip") {
              zlib.gzip(fileContents, cb);
            } else if (encoding === "br") {
              zlib.brotliCompress(fileContents, brotliOptions, cb);
            } else if (zstdSupported) {
              zlib.zstdCompress(fileContents, cb);
            }
          });
          await fsp.writeFile(compressedPath, compressedBuff);
        })
      );
    })
  );
}

function isTextMime(mimeType: string) {
  return /text|javascript|json|xml/.test(mimeType);
}

// Reference list of compressible MIME types from AWS
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html#compressed-content-cloudfront-file-types
const COMPRESSIBLE_MIMES_RE = new Set([
  "application/dash+xml",
  "application/eot",
  "application/font",
  "application/font-sfnt",
  "application/javascript",
  "application/json",
  "application/opentype",
  "application/otf",
  "application/pdf",
  "application/pkcs7-mime",
  "application/protobuf",
  "application/rss+xml",
  "application/truetype",
  "application/ttf",
  "application/vnd.apple.mpegurl",
  "application/vnd.mapbox-vector-tile",
  "application/vnd.ms-fontobject",
  "application/wasm",
  "application/xhtml+xml",
  "application/xml",
  "application/x-font-opentype",
  "application/x-font-truetype",
  "application/x-font-ttf",
  "application/x-httpd-cgi",
  "application/x-javascript",
  "application/x-mpegurl",
  "application/x-opentype",
  "application/x-otf",
  "application/x-perl",
  "application/x-ttf",
  "font/eot",
  "font/opentype",
  "font/otf",
  "font/ttf",
  "image/svg+xml",
  "text/css",
  "text/csv",
  "text/html",
  "text/javascript",
  "text/js",
  "text/plain",
  "text/richtext",
  "text/tab-separated-values",
  "text/xml",
  "text/x-component",
  "text/x-java-source",
  "text/x-script",
  "vnd.apple.mpegurl",
]);

function isCompressibleMime(mimeType: string) {
  return COMPRESSIBLE_MIMES_RE.has(mimeType);
}
