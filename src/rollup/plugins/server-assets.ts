import { promises as fsp } from "node:fs";
import createEtag from "etag";
import { glob } from "tinyglobby";
import mime from "mime";
import type { Nitro } from "nitropack/types";
import { resolve } from "pathe";
import type { Plugin } from "rollup";
import { normalizeKey } from "unstorage";
import { virtual } from "./virtual";

interface ResolvedAsset {
  fsPath: string;
  meta: {
    type?: string;
    etag?: string;
    mtime?: string;
  };
}

export function serverAssets(nitro: Nitro): Plugin {
  // Development: Use filesystem
  if (nitro.options.dev || nitro.options.preset === "nitro-prerender") {
    return virtual(
      { "#nitro-internal-virtual/server-assets": getAssetsDev(nitro) },
      nitro.vfs
    );
  }

  // Production: Bundle assets
  return virtual(
    {
      "#nitro-internal-virtual/server-assets": async () => {
        // Scan all assets
        const assets: Record<string, ResolvedAsset> = {};
        for (const asset of nitro.options.serverAssets) {
          const files = await glob(asset.pattern || "**/*", {
            cwd: asset.dir,
            absolute: false,
            ignore: asset.ignore,
          });
          for (const _id of files) {
            const fsPath = resolve(asset.dir, _id);
            const id = asset.baseName + "/" + _id;
            assets[id] = { fsPath, meta: {} };
            // @ts-ignore TODO: Use mime@2 types
            let type = mime.getType(id) || "text/plain";
            if (type.startsWith("text")) {
              type += "; charset=utf-8";
            }
            const etag = createEtag(await fsp.readFile(fsPath));
            const mtime = await fsp.stat(fsPath).then((s) => s.mtime.toJSON());
            assets[id].meta = { type, etag, mtime };
          }
        }
        return getAssetProd(assets);
      },
    },
    nitro.vfs
  );
}

function getAssetsDev(nitro: Nitro) {
  return `
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

const serverAssets = ${JSON.stringify(nitro.options.serverAssets)}

export const assets = createStorage()

for (const asset of serverAssets) {
  assets.mount(asset.baseName, fsDriver({ base: asset.dir, ignore: (asset?.ignore || []) }))
}`;
}

function getAssetProd(assets: Record<string, ResolvedAsset>) {
  return `
const _assets = {\n${Object.entries(assets)
    .map(
      ([id, asset]) =>
        `  [${JSON.stringify(
          normalizeKey(id)
        )}]: {\n    import: () => import(${JSON.stringify(
          "raw:" + asset.fsPath
        )}).then(r => r.default || r),\n    meta: ${JSON.stringify(
          asset.meta
        )}\n  }`
    )
    .join(",\n")}\n}

const normalizeKey = ${normalizeKey.toString()}

export const assets = {
  getKeys() {
    return Promise.resolve(Object.keys(_assets))
  },
  hasItem (id) {
    id = normalizeKey(id)
    return Promise.resolve(id in _assets)
  },
  getItem (id) {
    id = normalizeKey(id)
    return Promise.resolve(_assets[id] ? _assets[id].import() : null)
  },
  getMeta (id) {
    id = normalizeKey(id)
    return Promise.resolve(_assets[id] ? _assets[id].meta : {})
  }
}
`;
}
