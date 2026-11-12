import { promises as fsp } from "node:fs";
import createEtag from "etag";
import { glob } from "tinyglobby";
import mime from "mime";
import type { Nitro } from "nitro/types";
import type { PublicAsset } from "nitro/types";
import { relative, resolve } from "pathe";
import { joinURL, withTrailingSlash } from "ufo";
import { runParallel } from "../../utils/parallel.ts";
import { getPrerenderMeta } from "../../prerender/_meta.ts";
import { globPublicAssets } from "../assets.ts";

const readAssetHandler: Record<
  Exclude<Nitro["options"]["serveStatic"] | "true" | "false", boolean>,
  "node" | "null" | "inline"
> = {
  true: "node",
  node: "node",
  false: "null",
  inline: "inline",
};

export default function publicAssets(nitro: Nitro) {
  return [
    // public-assets-data
    {
      id: "#nitro/virtual/public-assets-data",
      template: async () => {
        const assets: Record<string, PublicAsset> = {};

        if (nitro.options.dev) {
          for (const asset of nitro.options.publicAssets) {
            for (const file of await globPublicAssets(nitro, asset)) {
              const assetId = joinURL(nitro.options.baseURL, asset.baseURL || "/", file);
              let type = mime.getType(file) || "text/plain";
              if (type.startsWith("text")) {
                type += "; charset=utf-8";
              }
              assets[assetId] ??= {
                type,
                path: resolve(asset.dir, file),
                etag: "",
                mtime: "",
                size: 0,
              };
            }
          }
          return `export default ${JSON.stringify(assets, null, 2)};`;
        }

        const files = await glob("**", {
          cwd: nitro.options.output.publicDir,
          absolute: false,
          dot: true,
        });

        const { errors } = await runParallel(
          new Set(files),
          async (id) => {
            let mimeType = mime.getType(id.replace(/\.(gz|br|zst)$/, "")) || "text/plain";
            if (mimeType.startsWith("text")) {
              mimeType += "; charset=utf-8";
            }
            const fullPath = resolve(nitro.options.output.publicDir, id);
            const [assetData, stat] = await Promise.all([
              fsp.readFile(fullPath),
              fsp.stat(fullPath),
            ]);

            const etag = createEtag(assetData);

            const assetId = joinURL(nitro.options.baseURL, decodeURIComponent(id));

            let encoding;
            if (id.endsWith(".gz")) {
              encoding = "gzip";
            } else if (id.endsWith(".br")) {
              encoding = "br";
            } else if (id.endsWith(".zst")) {
              encoding = "zstd";
            }

            assets[assetId] = {
              type: getPrerenderMeta(nitro)[assetId]?.contentType || mimeType,
              encoding,
              etag,
              mtime: stat.mtime.toJSON(),
              size: stat.size,
              path: relative(nitro.options.output.serverDir, fullPath),
              data:
                nitro.options.serveStatic === "inline" ? assetData.toString("base64") : undefined,
            };
          },
          { concurrency: 25 }
        );

        if (errors.length > 0) {
          throw new Error(`Failed to process public assets:\n${errors.join("\n")}`, {
            cause: errors,
          });
        }

        // Files finish reading in any order: sort them so each build writes the same output
        const sorted = Object.fromEntries(
          Object.entries(assets).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        );
        return `export default ${JSON.stringify(sorted, null, 2)};`;
      },
    },

    // public-assets
    {
      id: "#nitro/virtual/public-assets",
      template: () => {
        const publicAssetBases = Object.fromEntries(
          nitro.options.publicAssets
            .filter((dir) => !dir.fallthrough && dir.baseURL !== "/")
            .map((dir) => [
              withTrailingSlash(joinURL(nitro.options.baseURL, dir.baseURL || "/")),
              { maxAge: dir.maxAge },
            ])
        );

        // prettier-ignore
        type _serveStaticAsKey = Exclude<typeof nitro.options.serveStatic, boolean> | "true" | "false";
        // prettier-ignore
        const handlerName = readAssetHandler[nitro.options.serveStatic as _serveStaticAsKey] || "null";
        const readAssetImport = `#nitro/virtual/public-assets-${handlerName}`;

        return /* js */ `
import assets from '#nitro/virtual/public-assets-data'
export { readAsset } from "${readAssetImport}"
export const publicAssetBases = ${JSON.stringify(publicAssetBases)}

export function isPublicAssetURL(id = '') {
  return hasAsset(id) || isPublicAssetBaseURL(id)
}

export function isPublicAssetBaseURL(id = '') {
  for (const base in publicAssetBases) {
    if (id.startsWith(base)) { return true }
  }
  return false
}

export function getPublicAssetMeta(id = '') {
  for (const base in publicAssetBases) {
    if (id.startsWith(base)) { return publicAssetBases[base] }
  }
  return {}
}

export function getAsset (id) {
  return assets[id]
}

// Encoding extensions by flag bit (\`EncodingMap\` of the static middleware must not add others)
const _exts = ['', '.br', '.gz', '.zst']
// Bit offset of the \`id/index.html + ext\` flags, after the \`id + ext\` ones
const _INDEX = _exts.length

let _servable

// Request ids to flags of the files that serve them
function _getServable () {
  if (!_servable) {
    const servable = new Map()
    for (const assetId in assets) {
      const plainId = assetId.replace(/\\.(gz|br|zst)$/, '')
      const ext = _exts.indexOf(assetId.slice(plainId.length))
      _flag(servable, assetId, 1)
      if (ext) {
        _flag(servable, plainId, 1 << ext)
      }
      if (plainId.endsWith('/index.html')) {
        const dir = plainId.slice(0, -'index.html'.length)
        _flag(servable, dir, 1 << (_INDEX + ext))
        if (dir !== '/') {
          _flag(servable, dir.slice(0, -1), 1 << (_INDEX + ext))
        }
      }
    }
    _servable = servable
  }
  return _servable
}

function _flag (servable, id, flag) {
  servable.set(id, (servable.get(id) || 0) | flag)
}

export function hasAsset (id = '') {
  return _getServable().has(id)
}

// Flags of the compressed files, for the request id and for its \`index.html\`
const _ENCODED = ((1 << _INDEX) - 1) & ~1
const _ENCODED_MASK = _ENCODED | (_ENCODED << _INDEX)

// Whether the response for a request id depends on its \`Accept-Encoding\`
export function hasEncodedVariants (id = '') {
  return !!((_getServable().get(id) || 0) & _ENCODED_MASK)
}

// Asset id for the first encoding extension (most preferred first) that has a file
export function resolveAsset (id, encodings) {
  const flags = _getServable().get(id)
  if (flags) {
    for (const encoding of encodings) {
      const ext = _exts.indexOf(encoding)
      if (ext < 0) {
        continue
      }
      if (flags & (1 << ext)) {
        return id + encoding
      }
      if (flags & (1 << (_INDEX + ext))) {
        return (id.endsWith('/') ? id : id + '/') + 'index.html' + encoding
      }
    }
  }
}
`;
      },
    },

    // TODO: Handlers can be static templates!

    // public-assets-node
    {
      id: "#nitro/virtual/public-assets-node",
      template: () => {
        // Dev asset paths are absolute, and the Vite dev runner does not set `__nitro_main__`
        const path = nitro.options.dev
          ? "assets[id].path"
          : "resolve(dirname(fileURLToPath(globalThis.__nitro_main__)), assets[id].path)";
        return /* js */ `
import { promises as fsp } from 'node:fs'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import assets from '#nitro/virtual/public-assets-data'
export function readAsset (id, range) {
  const path = ${path}
  // Public dirs might be pruned after the build (uploaded to a CDN, sourcemaps
  // stripped), so a manifest entry with no file behind it reads as absent, not broken.
  return (range ? readRange(path, range) : fsp.readFile(path)).catch((error) => {
    if (error?.code !== 'ENOENT') { throw error }
  })
}
// Opened before streaming so a missing file still reads as absent
async function readRange (path, { start, end }) {
  const handle = await fsp.open(path)
  return Readable.toWeb(handle.createReadStream({ start, end }))
}`;
      },
    },

    // public-assets-null
    {
      id: "#nitro/virtual/public-assets-null",
      template: () => {
        return /* js */ `
    export function readAsset (id) {
        return Promise.resolve(null);
    }`;
      },
    },

    // public-assets-inline
    {
      id: "#nitro/virtual/public-assets-inline",
      template: () => {
        return /* js */ `
  import assets from '#nitro/virtual/public-assets-data'
  export function readAsset (id) {
    if (!assets[id]) { return undefined }
    if (assets[id]._data) { return assets[id]._data }
    if (!assets[id].data) { return assets[id].data }
    assets[id]._data = Uint8Array.from(atob(assets[id].data), (c) => c.charCodeAt(0))
    return assets[id]._data
}`;
      },
    },
  ];
}
