import { promises as fsp } from "node:fs";
import createEtag from "etag";
import { globby } from "globby";
import mime from "mime";
import type { Nitro, ServerAssetDir } from "nitropack/types";
import { join, relative, resolve } from "pathe";
import type { Plugin } from "rollup";
import { normalizeKey } from "unstorage";
import { runParallel } from "../../core/utils/parallel";
import { virtual } from "./virtual";

interface ResolvedAsset {
  fsPath: string;
  meta: {
    type?: string;
    etag?: string;
    mtime?: string;
  };
  /** Set when `embed: "inline"` (utf8 text or base64 for binary). */
  data?: string;
  encoding?: "base64";
}

type EmbedMode = boolean | "inline";

function resolveEmbedMode(asset: ServerAssetDir): EmbedMode {
  return asset.embed ?? true;
}

function isBinaryType(type: string): boolean {
  return !/^(text\/|application\/(json|xml|javascript)|image\/svg)/.test(type);
}

/**
 * Path relative to `output.serverDir` — same convention as `public-assets`
 * (`resolve(dirname(import.meta.url), path)` at runtime).
 */
function pathFromServerDir(nitro: Nitro, absPath: string): string {
  return relative(nitro.options.output.serverDir, absPath).replace(/\\/g, "/");
}

export function serverAssets(nitro: Nitro): Plugin {
  // Development: Use filesystem
  if (nitro.options.dev || nitro.options.preset === "nitro-prerender") {
    return virtual(
      { "#nitro-internal-virtual/server-assets": getAssetsDev(nitro) },
      nitro.vfs
    );
  }

  const fsAssetDirs = nitro.options.serverAssets.filter(
    (a) => resolveEmbedMode(a) === false
  );

  if (fsAssetDirs.length > 0) {
    nitro.hooks.hook("compiled", async () => {
      for (const asset of fsAssetDirs) {
        const dest = join(
          nitro.options.output.serverDir,
          "assets",
          asset.baseName
        );
        await fsp.cp(asset.dir, dest, { recursive: true, force: true });
      }
    });
  }

  // Production: Bundle assets (or keep on disk when embed:false)
  return virtual(
    {
      "#nitro-internal-virtual/server-assets": async () => {
        const embedAssets = nitro.options.serverAssets.filter(
          (a) => resolveEmbedMode(a) !== false
        );

        if (embedAssets.length === 0) {
          return getAssetsFs(nitro, fsAssetDirs);
        }

        const inlineAssets: Record<string, ResolvedAsset> = {};
        const rawAssets: Record<string, ResolvedAsset> = {};

        for (const asset of embedAssets) {
          const mode = resolveEmbedMode(asset);
          const files = await globby(asset.pattern || "**/*", {
            cwd: asset.dir,
            absolute: false,
            ignore: asset.ignore,
          });

          const { errors } = await runParallel(
            new Set(files),
            async (_id) => {
              const fsPath = resolve(asset.dir, _id);
              const id = normalizeKey(asset.baseName + "/" + _id);
              // @ts-ignore TODO: Use mime@2 types
              let type = mime.getType(id) || "text/plain";
              if (type.startsWith("text")) {
                type += "; charset=utf-8";
              }

              const [data, stat] = await Promise.all([
                fsp.readFile(fsPath),
                fsp.stat(fsPath),
              ]);
              const meta = {
                type,
                etag: createEtag(data),
                mtime: stat.mtime.toJSON(),
              };

              if (mode === "inline") {
                const binary = isBinaryType(type);
                inlineAssets[id] = {
                  fsPath,
                  meta,
                  data: binary
                    ? data.toString("base64")
                    : data.toString("utf8"),
                  encoding: binary ? "base64" : undefined,
                };
              } else {
                rawAssets[id] = { fsPath, meta };
              }
            },
            { concurrency: 25 }
          );

          if (errors.length > 0) {
            throw new Error(
              `Failed to process some server assets:\n- ${errors
                .map((e) => (e instanceof Error ? e.message : String(e)))
                .join("\n- ")}`
            );
          }
        }

        return getAssetProd(nitro, inlineAssets, rawAssets, fsAssetDirs);
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

function getAssetsFs(nitro: Nitro, fsAssets: ServerAssetDir[]) {
  const mounts = fsAssets.map((asset) => ({
    baseName: asset.baseName,
    path: pathFromServerDir(
      nitro,
      join(nitro.options.output.serverDir, "assets", asset.baseName)
    ),
    ignore: asset.ignore || [],
  }));

  return `
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

const serverDir = dirname(fileURLToPath(import.meta.url))
const mounts = ${JSON.stringify(mounts)}

export const assets = createStorage()

for (const asset of mounts) {
  assets.mount(asset.baseName, fsDriver({
    base: resolve(serverDir, asset.path),
    ignore: asset.ignore || [],
  }))
}`;
}

function getAssetProd(
  nitro: Nitro,
  inlineAssets: Record<string, ResolvedAsset>,
  rawAssets: Record<string, ResolvedAsset>,
  fsAssets: ServerAssetDir[]
) {
  const hasFs = fsAssets.length > 0;
  const hasInline = Object.keys(inlineAssets).length > 0;

  // Default embed:true with no fs mounts — keep the historical template shape.
  if (!hasFs && !hasInline) {
    return getAssetProdRawOnly(rawAssets);
  }

  const fsMounts = fsAssets.map((asset) => ({
    baseName: asset.baseName,
    path: pathFromServerDir(
      nitro,
      join(nitro.options.output.serverDir, "assets", asset.baseName)
    ),
    ignore: asset.ignore || [],
  }));

  const inlineEntries = Object.entries(inlineAssets)
    .map(([id, asset]) => {
      const dataExpr =
        asset.encoding === "base64"
          ? `Buffer.from(${JSON.stringify(asset.data)}, "base64")`
          : JSON.stringify(asset.data);
      return `  [${JSON.stringify(id)}]: {\n    data: ${dataExpr},\n    meta: ${JSON.stringify(asset.meta)}\n  }`;
    })
    .join(",\n");

  const rawEntries = Object.entries(rawAssets)
    .map(
      ([id, asset]) =>
        `  [${JSON.stringify(id)}]: {\n    import: () => import(${JSON.stringify(
          "raw:" + asset.fsPath
        )}).then(r => r.default || r),\n    meta: ${JSON.stringify(asset.meta)}\n  }`
    )
    .join(",\n");

  return `
${
  hasFs
    ? `import { createStorage as __createFsStorage } from 'unstorage'
import __fsDriver from 'unstorage/drivers/fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
const serverDir = dirname(fileURLToPath(import.meta.url))
const __fsMounts = ${JSON.stringify(fsMounts)}
const __fsAssets = __createFsStorage()
for (const asset of __fsMounts) {
  __fsAssets.mount(asset.baseName, __fsDriver({ base: resolve(serverDir, asset.path), ignore: asset.ignore || [] }))
}`
    : `const __fsAssets = null`
}

const _inline = {
${inlineEntries}
}

const _raw = {
${rawEntries}
}

const normalizeKey = ${normalizeKey.toString()}

export const assets = {
  async getKeys() {
    const keys = [...Object.keys(_inline), ...Object.keys(_raw)]
    if (__fsAssets) {
      keys.push(...(await __fsAssets.getKeys()).map((k) => normalizeKey(k)))
    }
    return keys
  },
  async hasItem (id) {
    id = normalizeKey(id)
    if (id in _inline || id in _raw) return true
    return __fsAssets ? __fsAssets.hasItem(id) : false
  },
  async getItem (id) {
    id = normalizeKey(id)
    if (id in _inline) return _inline[id].data
    if (id in _raw) return _raw[id].import()
    return __fsAssets ? __fsAssets.getItem(id) : null
  },
  async getMeta (id) {
    id = normalizeKey(id)
    if (id in _inline) return _inline[id].meta
    if (id in _raw) return _raw[id].meta
    return __fsAssets ? __fsAssets.getMeta(id) : {}
  }
}
`;
}

function getAssetProdRawOnly(assets: Record<string, ResolvedAsset>) {
  return `
const _assets = {
${Object.entries(assets)
  .map(
    ([id, asset]) =>
      `  [${JSON.stringify(id)}]: {\n    import: () => import(${JSON.stringify(
        "raw:" + asset.fsPath
      )}).then(r => r.default || r),\n    meta: ${JSON.stringify(asset.meta)}\n  }`
  )
  .join(",\n")}
}

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
