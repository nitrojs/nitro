import { promises as fsp } from "node:fs";
import createEtag from "etag";
import { glob } from "tinyglobby";
import mime from "mime";
import type { Nitro } from "nitro/types";
import type { PublicAsset, PublicAssetVariant } from "nitro/types";
import { relative, resolve } from "pathe";
import { joinURL, withTrailingSlash } from "ufo";
import { ENCODING_EXTS } from "../../utils/compress.ts";
import { runParallel } from "../../utils/parallel.ts";
import { isPrefixedPublicAssetDir } from "../../config/resolvers/assets.ts";
import { getPrerenderMeta } from "../../prerender/_meta.ts";
import { globPublicAssets } from "../assets.ts";

export default function publicAssets(nitro: Nitro) {
  return [
    // public-assets-data
    {
      id: "#nitro/virtual/public-assets-data",
      template: async () => {
        const manifest = nitro.options.dev ? await getDevManifest(nitro) : await getManifest(nitro);
        // Without `serveStatic`, only `isPublicAssetURL` reads the manifest: it needs the ids alone
        return `export default ${
          Array.isArray(manifest)
            ? `new Set(${JSON.stringify(manifest, null, 2)})`
            : JSON.stringify(manifest, null, 2)
        };`;
      },
    },

    // public-assets
    {
      id: "#nitro/virtual/public-assets",
      template: () => {
        const bases = nitro.options.publicAssets
          .filter(isPrefixedPublicAssetDir)
          .map((dir) => withTrailingSlash(joinURL(nitro.options.baseURL, dir.baseURL)));
        const isPublicAssetBaseURL = /* js */ `
export function isPublicAssetBaseURL(id = '') {
  return ${bases.map((base) => `id.startsWith(${JSON.stringify(base)})`).join(" || ") || "false"}
}`;
        if (!nitro.options.serveStatic) {
          return /* js */ `
import ids from '#nitro/virtual/public-assets-data'
${isPublicAssetBaseURL}
export function isPublicAssetURL(id = '') {
  return ids.has(id) || isPublicAssetBaseURL(id)
}`;
        }
        const reader = nitro.options.serveStatic === "inline" ? "inline" : "node";
        return /* js */ `
import { isAssetFile } from '#nitro/runtime/public-assets'
export { readAsset } from '#nitro/runtime/public-assets-${reader}'
${isPublicAssetBaseURL}
export function isPublicAssetURL(id = '') {
  return isAssetFile(id) || isPublicAssetBaseURL(id)
}`;
      },
    },
  ];
}

// Ids of the files (decoded, as in the public dir) without `serveStatic`, else the manifest
async function getManifest(nitro: Nitro): Promise<string[] | Record<string, Partial<PublicAsset>>> {
  const { baseURL, serveStatic, output } = nitro.options;
  // Sorted, so each build writes the same output and a plain file comes before its copies
  const files = (await glob("**", { cwd: output.publicDir, absolute: false, dot: true })).sort(
    compare
  );
  if (!serveStatic) {
    return files.map((file) => joinURL(baseURL, decodeURIComponent(file)));
  }

  const metas = new Map<string, PublicAssetVariant>();
  const { errors } = await runParallel(
    new Set(files),
    async (file) => {
      const fullPath = resolve(output.publicDir, file);
      const [data, stat] = await Promise.all([fsp.readFile(fullPath), fsp.stat(fullPath)]);
      metas.set(file, {
        etag: createEtag(data),
        mtime: stat.mtime.toJSON(),
        size: stat.size,
        data: serveStatic === "inline" ? data.toString("base64") : undefined,
      });
    },
    { concurrency: 25 }
  );
  if (errors.length > 0) {
    throw new Error(`Failed to process public assets:\n${errors.join("\n")}`, { cause: errors });
  }

  // Compressed copies (`<file>.br`, ...) are variants of the entry of their plain file
  const manifest: Record<string, Partial<PublicAsset>> = {};
  const parsed = files.map((file) => {
    const encoding = getCopyEncoding(file);
    const plainFile = encoding ? file.slice(0, -ENCODING_EXTS[encoding].length) : file;
    return { file, encoding, plainFile, id: joinURL(baseURL, decodeURIComponent(plainFile)) };
  });
  const sources = getSources(parsed);
  const skipped = new Map<string, { id: string; files: string[] }>();
  for (const { file, encoding, plainFile, id } of parsed) {
    if (sources.get(id) !== plainFile) {
      let group = skipped.get(plainFile);
      if (!group) {
        skipped.set(plainFile, (group = { id, files: [] }));
      }
      group.files.push(file);
      continue;
    }
    const entry = (manifest[id] ??= {
      type: getPrerenderMeta(nitro)[id]?.contentType || getType(id),
      path: relative(output.serverDir, resolve(output.publicDir, plainFile)),
    });
    const meta = metas.get(file)!;
    if (encoding) {
      // Copies are generated from their plain file (sorted first): they share its `mtime`.
      // Without one, the entry has no `etag`, `mtime` and `size`: only its `variants`.
      (entry.variants ??= {})[encoding] = { ...meta, mtime: entry.mtime ? undefined : meta.mtime };
    } else {
      Object.assign(entry, meta);
    }
  }
  for (const [plainFile, { id, files }] of skipped) {
    nitro.logger.warn(
      `Public asset \`${plainFile}\` (${files.map((file) => `\`${file}\``).join(", ")}) is not served: \`${sources.get(id)}\` is served at the same URL (\`${id}\`).`
    );
  }
  // Decoding can change the order of the ids
  return Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => compare(a, b)));
}

async function getDevManifest(nitro: Nitro): Promise<string[] | Record<string, PublicAsset>> {
  const assets: Record<string, PublicAsset> = {};
  for (const asset of nitro.options.publicAssets) {
    for (const file of await globPublicAssets(nitro, asset)) {
      const id = joinURL(nitro.options.baseURL, asset.baseURL || "/", file);
      assets[id] ??= {
        type: getType(file),
        path: resolve(asset.dir, file),
        etag: "",
        mtime: "",
        size: 0,
      };
    }
  }
  return nitro.options.serveStatic ? assets : Object.keys(assets);
}

// Files whose names decode to the same id (`a%20b.txt` and `a b.txt`) are not mixed: one plain
// file name is served with its copies, the first one that has a plain file (else the first one).
function getSources(
  files: { encoding?: string; plainFile: string; id: string }[]
): Map<string, string> {
  const sources = new Map<string, string>();
  for (const plain of [true, false]) {
    for (const { encoding, plainFile, id } of files) {
      if (!encoding === plain && !sources.has(id)) {
        sources.set(id, plainFile);
      }
    }
  }
  return sources;
}

// Encoding of a compressed copy, by its name. A file named only `.gz` (or `dir/.br`) is not one.
function getCopyEncoding(file: string): keyof typeof ENCODING_EXTS | undefined {
  for (const [encoding, ext] of Object.entries(ENCODING_EXTS)) {
    if (file.endsWith(ext) && file.length > ext.length && file.at(-ext.length - 1) !== "/") {
      return encoding as keyof typeof ENCODING_EXTS;
    }
  }
}

function getType(file: string): string {
  const type = mime.getType(file) || "text/plain";
  return type.startsWith("text") ? `${type}; charset=utf-8` : type;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
