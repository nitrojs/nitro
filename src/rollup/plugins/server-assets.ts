import { promises as fsp } from "node:fs";
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
  data?: string | Uint8Array;
}

type EmbedMode = boolean | "inline";

function resolveEmbedMode(asset: ServerAssetDir): EmbedMode {
  return asset.embed ?? true;
}

/** Weak etag from size + mtime — avoids reading every file during the scan. */
function weakEtag(size: number, mtimeMs: number): string {
  return `W/"${size.toString(16)}-${Math.trunc(mtimeMs).toString(16)}"`;
}

function isProbablyText(type: string, id: string): boolean {
  if (
    type.startsWith("text") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("javascript")
  ) {
    return true;
  }
  return /\.(json|jsonc|txt|md|html|htm|svg|css|csv|tsv|xml|yaml|yml|toml)$/i.test(
    id
  );
}

/**
 * Path from the main nitro chunk (`chunks/nitro/nitro.mjs`) to a server-dir relative folder.
 */
function relFromNitroChunk(serverDir: string, absTarget: string): string {
  return relative(join(serverDir, "chunks/nitro"), absTarget).replace(
    /\\/g,
    "/"
  );
}

export function serverAssets(nitro: Nitro): Plugin {
  if (nitro.options.dev || nitro.options.preset === "nitro-prerender") {
    return virtual(
      { "#nitro-internal-virtual/server-assets": getAssetsDev(nitro) },
      nitro.vfs
    );
  }

  const fsAssetDirs = nitro.options.serverAssets.filter(
    (a) => resolveEmbedMode(a) === false
  );

  // Register copy once (not inside the virtual template, which may re-run).
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

  return virtual(
    {
      "#nitro-internal-virtual/server-assets": async () => {
        const embedAssets = nitro.options.serverAssets.filter(
          (a) => resolveEmbedMode(a) !== false
        );

        if (embedAssets.length === 0) {
          return getAssetsFsOnly(nitro, fsAssetDirs);
        }

        const allInline: { id: string; asset: ResolvedAsset }[] = [];
        const allRaw: { id: string; asset: ResolvedAsset }[] = [];

        for (const asset of embedAssets) {
          const mode = resolveEmbedMode(asset);
          const files = await globby(asset.pattern || "**/*", {
            cwd: asset.dir,
            absolute: false,
            ignore: asset.ignore,
          });

          // Explicit inline, or auto-inline many small text files (avoids N× raw: modules).
          const autoInline =
            mode === "inline" || (mode === true && files.length >= 50);

          await runParallel(
            new Set(files),
            async (_id) => {
              const fsPath = resolve(asset.dir, _id);
              const id = asset.baseName + "/" + _id;
              // @ts-ignore TODO: Use mime@2 types
              let type = mime.getType(id) || "text/plain";
              if (type.startsWith("text")) {
                type += "; charset=utf-8";
              }
              const stat = await fsp.stat(fsPath);
              const meta = {
                type,
                etag: weakEtag(stat.size, stat.mtimeMs),
                mtime: stat.mtime.toJSON(),
              };
              const resolved: ResolvedAsset = { fsPath, meta };

              const useInline =
                mode === "inline" ||
                (autoInline &&
                  isProbablyText(type, _id) &&
                  stat.size <= 64 * 1024);

              if (useInline) {
                const buf = await fsp.readFile(fsPath);
                resolved.data = isProbablyText(type, _id)
                  ? buf.toString("utf8")
                  : buf;
                allInline.push({ id, asset: resolved });
              } else {
                allRaw.push({ id, asset: resolved });
              }
            },
            { concurrency: 16 }
          );
        }

        return getAssetProdMixed(nitro, allInline, allRaw, fsAssetDirs);
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

function getAssetsFsOnly(nitro: Nitro, fsAssets: ServerAssetDir[]) {
  const mounts = fsAssets.map((asset) => ({
    baseName: asset.baseName,
    rel: relFromNitroChunk(
      nitro.options.output.serverDir,
      join(nitro.options.output.serverDir, "assets", asset.baseName)
    ),
    ignore: asset.ignore || [],
  }));
  return `
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mounts = ${JSON.stringify(mounts)}

export const assets = createStorage()

for (const asset of mounts) {
  assets.mount(asset.baseName, fsDriver({
    base: join(__dirname, asset.rel),
    ignore: asset.ignore || [],
  }))
}
`;
}

function getAssetProdMixed(
  nitro: Nitro,
  inlineAssets: { id: string; asset: ResolvedAsset }[],
  rawAssets: { id: string; asset: ResolvedAsset }[],
  fsAssets: ServerAssetDir[]
) {
  const inlineEntries = inlineAssets
    .map(({ id, asset }) => {
      const payload =
        typeof asset.data === "string"
          ? JSON.stringify(asset.data)
          : `Uint8Array.from(atob(${JSON.stringify(
              Buffer.from(asset.data || []).toString("base64")
            )}), c => c.charCodeAt(0))`;
      return `  [${JSON.stringify(normalizeKey(id))}]: {\n    data: ${payload},\n    meta: ${JSON.stringify(asset.meta)}\n  }`;
    })
    .join(",\n");

  const rawEntries = rawAssets
    .map(
      ({ id, asset }) =>
        `  [${JSON.stringify(normalizeKey(id))}]: {\n    import: () => import(${JSON.stringify(
          "raw:" + asset.fsPath
        )}).then(r => r.default || r),\n    meta: ${JSON.stringify(asset.meta)}\n  }`
    )
    .join(",\n");

  const fsMounts = fsAssets.map((a) => ({
    baseName: a.baseName,
    rel: relFromNitroChunk(
      nitro.options.output.serverDir,
      join(nitro.options.output.serverDir, "assets", a.baseName)
    ),
    ignore: a.ignore || [],
  }));

  const fsBootstrap =
    fsMounts.length > 0
      ? `
import { createStorage as __createFsStorage } from 'unstorage'
import __fsDriver from 'unstorage/drivers/fs'
import { fileURLToPath as __fileURLToPath } from 'node:url'
import { dirname as __dirnameOf, join as __join } from 'pathe'
const __dirname = __dirnameOf(__fileURLToPath(import.meta.url))
const __fsMounts = ${JSON.stringify(fsMounts)}
const __fsAssets = __createFsStorage()
for (const asset of __fsMounts) {
  __fsAssets.mount(asset.baseName, __fsDriver({ base: __join(__dirname, asset.rel), ignore: asset.ignore || [] }))
}
`
      : `
const __fsAssets = null
const __fsMounts = []
`;

  return `
${fsBootstrap}

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
      const fsKeys = await __fsAssets.getKeys()
      keys.push(...fsKeys.map((k) => normalizeKey(k)))
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
