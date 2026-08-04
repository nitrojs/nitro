import { promises as fsp } from "node:fs";
import createEtag from "etag";
import { globby } from "globby";
import mime from "mime";
import type { Nitro, ServerAssetDir } from "nitropack/types";
import { join, relative, resolve } from "pathe";
import type { Plugin } from "rollup";
import { normalizeKey } from "unstorage";
import { runParallel } from "../../core/utils/parallel";
import { isBinary } from "./raw";
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
  // Default `true` preserves historical one-raw-module-per-file behavior.
  return asset.embed ?? true;
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

  // Opt-in only: copy filesystem embeds after compile (does not run for default embed:true).
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

  // Production: Bundle assets (default) or keep on disk when embed:false
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
                // Same binary detection as the `raw:` plugin; base64 like public-assets inline.
                const binary = isBinary(fsPath);
                inlineAssets[id] = {
                  fsPath,
                  meta,
                  data: binary
                    ? data.toString("base64")
                    : data.toString("utf8"),
                  encoding: binary ? "base64" : undefined,
                };
              } else {
                // embed: true (default) — historical lazy raw: modules
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

  // Same shape as getAssetProdRawOnly / mixed path — wrap fsDriver so getMeta
  // still exposes `type` (mime) like embedded assets. Default raw: path untouched.
  return `
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import mime from 'mime'

const serverDir = dirname(fileURLToPath(import.meta.url))
const mounts = ${JSON.stringify(mounts)}

const __fs = createStorage()
for (const asset of mounts) {
  __fs.mount(asset.baseName, fsDriver({
    base: resolve(serverDir, asset.path),
    ignore: asset.ignore || [],
  }))
}

const normalizeKey = ${normalizeKey.toString()}

function withType(id, meta) {
  // @ts-ignore mime@2
  let type = mime.getType(id) || "text/plain"
  if (type.startsWith("text")) type += "; charset=utf-8"
  return { ...meta, type }
}

export const assets = {
  getKeys: () => __fs.getKeys(),
  hasItem: (id) => __fs.hasItem(id),
  getItem: (id) => __fs.getItem(id),
  async getMeta (id) {
    id = normalizeKey(id)
    return withType(id, await __fs.getMeta(id))
  }
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

  // Default path unchanged: only raw: embeds → original template.
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

  // Decode base64 like `#nitro-internal-virtual/public-assets-inline` (atob, not Buffer).
  const inlineEntries = Object.entries(inlineAssets)
    .map(([id, asset]) => {
      const dataExpr =
        asset.encoding === "base64"
          ? `Uint8Array.from(atob(${JSON.stringify(asset.data)}), (c) => c.charCodeAt(0))`
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
import __mime from 'mime'
const serverDir = dirname(fileURLToPath(import.meta.url))
const __fsMounts = ${JSON.stringify(fsMounts)}
const __fsAssets = __createFsStorage()
for (const asset of __fsMounts) {
  __fsAssets.mount(asset.baseName, __fsDriver({ base: resolve(serverDir, asset.path), ignore: asset.ignore || [] }))
}
function __fsMetaWithType(id, meta) {
  // @ts-ignore mime@2
  let type = __mime.getType(id) || "text/plain"
  if (type.startsWith("text")) type += "; charset=utf-8"
  return { ...meta, type }
}`
    : `const __fsAssets = null
const __fsMetaWithType = (_id, meta) => meta`
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
    if (!__fsAssets) return {}
    return __fsMetaWithType(id, await __fsAssets.getMeta(id))
  }
}
`;
}

/** Historical production template — one lazy `raw:` import per file. */
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
