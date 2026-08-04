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
  /** Absolute source path (used for `raw:` imports). */
  fsPath: string;
  meta: {
    type?: string;
    etag?: string;
    mtime?: string;
  };
  /** `embed: "inline"` — utf8 text or base64 payload. */
  data?: string;
  encoding?: "base64";
  /**
   * `embed: false` — path relative to `output.serverDir`
   * (same idea as public-assets `assets[id].path` + `readAsset`).
   */
  path?: string;
  /** `embed: false` — decode as Uint8Array vs utf8 string. */
  binary?: boolean;
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

async function collectAssetMeta(
  asset: ServerAssetDir,
  _id: string
): Promise<{
  id: string;
  fsPath: string;
  data: Buffer;
  meta: ResolvedAsset["meta"];
}> {
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
  return {
    id,
    fsPath,
    data,
    meta: {
      type,
      etag: createEtag(data),
      mtime: stat.mtime.toJSON(),
    },
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
        const inlineAssets: Record<string, ResolvedAsset> = {};
        const rawAssets: Record<string, ResolvedAsset> = {};
        const diskAssets: Record<string, ResolvedAsset> = {};

        for (const asset of nitro.options.serverAssets) {
          const mode = resolveEmbedMode(asset);
          const files = await globby(asset.pattern || "**/*", {
            cwd: asset.dir,
            absolute: false,
            ignore: asset.ignore,
          });

          const { errors } = await runParallel(
            new Set(files),
            async (_id) => {
              const { id, fsPath, data, meta } = await collectAssetMeta(
                asset,
                _id
              );

              if (mode === false) {
                // public-assets-node style: meta + relative path, readFile at runtime
                diskAssets[id] = {
                  fsPath,
                  meta,
                  path: pathFromServerDir(
                    nitro,
                    join(
                      nitro.options.output.serverDir,
                      "assets",
                      asset.baseName,
                      _id
                    )
                  ),
                  binary: isBinary(fsPath),
                };
              } else if (mode === "inline") {
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

        return getAssetProd(inlineAssets, rawAssets, diskAssets);
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

/**
 * Production virtual module.
 *
 * - raw only → historical template (byte-identical shape to pre-change Nitro)
 * - otherwise → same map pattern as public-assets-data (+ raw imports / inline / disk paths)
 */
function getAssetProd(
  inlineAssets: Record<string, ResolvedAsset>,
  rawAssets: Record<string, ResolvedAsset>,
  diskAssets: Record<string, ResolvedAsset>
) {
  const hasInline = Object.keys(inlineAssets).length > 0;
  const hasDisk = Object.keys(diskAssets).length > 0;

  // Default path unchanged: only raw: embeds → original template.
  if (!hasInline && !hasDisk) {
    return getAssetProdRawOnly(rawAssets);
  }

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

  const diskEntries = Object.entries(diskAssets)
    .map(
      ([id, asset]) =>
        `  [${JSON.stringify(id)}]: {\n    path: ${JSON.stringify(
          asset.path
        )},\n    binary: ${asset.binary ? "true" : "false"},\n    meta: ${JSON.stringify(
          asset.meta
        )}\n  }`
    )
    .join(",\n");

  return `
import { promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

const serverDir = dirname(fileURLToPath(import.meta.url))

const _inline = {
${inlineEntries}
}

const _raw = {
${rawEntries}
}

const _disk = {
${diskEntries}
}

const normalizeKey = ${normalizeKey.toString()}

export const assets = {
  async getKeys() {
    return [...Object.keys(_inline), ...Object.keys(_raw), ...Object.keys(_disk)]
  },
  async hasItem (id) {
    id = normalizeKey(id)
    return id in _inline || id in _raw || id in _disk
  },
  async getItem (id) {
    id = normalizeKey(id)
    if (id in _inline) return _inline[id].data
    if (id in _raw) return _raw[id].import()
    if (id in _disk) {
      const a = _disk[id]
      const buf = await fsp.readFile(resolve(serverDir, a.path))
      return a.binary ? new Uint8Array(buf) : buf.toString('utf8')
    }
    return null
  },
  async getMeta (id) {
    id = normalizeKey(id)
    return _inline[id]?.meta || _raw[id]?.meta || _disk[id]?.meta || {}
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
