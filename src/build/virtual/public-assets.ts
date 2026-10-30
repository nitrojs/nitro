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
  if (assets[id]) {
    return true
  }
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

export function hasAsset (id = '') {
  return !!(assets[id] || assets[id + '.gz'] || assets[id + '.br'] || assets[id + '.zst'])
}
`;
      },
    },

    // TODO: Handlers can be static templates!

    // public-assets-node
    {
      id: "#nitro/virtual/public-assets-node",
      template: () => {
        return /* js */ `
import { promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import assets from '#nitro/virtual/public-assets-data'
export function readAsset (id) {
  const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__))
  // Public dirs might be pruned after the build (uploaded to a CDN, sourcemaps
  // stripped), so a manifest entry with no file behind it reads as absent, not broken.
  return fsp.readFile(resolve(serverDir, assets[id].path)).catch((error) => {
    if (error?.code !== 'ENOENT') { throw error }
  })
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
