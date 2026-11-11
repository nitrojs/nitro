import type { PublicAsset, PublicAssetVariant } from "nitro/types";
import assets from "#nitro/virtual/public-assets-data";

export type ServedAsset = { id: string; asset: PublicAsset };

type Entry = Pick<PublicAsset, "type" | "path"> &
  Partial<PublicAsset> & { _served?: ServedAsset; variants?: Record<string, Variant> };

type Variant = PublicAssetVariant & { _served?: ServedAsset };

/** Extensions of the compressed copies by encoding (as written by the build): no others are served */
export const ENCODING_EXTS: Record<string, string | undefined> = Object.assign(
  Object.create(null),
  { br: ".br", gzip: ".gz", zstd: ".zst" }
);

export interface PublicAssetsLookup {
  hasAsset(id: string): boolean;
  /** Whether a file of the public dir is named like `id` */
  isAssetFile(id: string): boolean;
  /** Whether the response for a request id depends on its `Accept-Encoding` */
  hasEncodedVariants(id: string): boolean;
  /** Served file for the first encoding (most preferred first, `''` for none) that has one */
  resolveAsset(id: string, encodings: readonly string[]): ServedAsset | undefined;
}

export function createPublicAssetsLookup(manifest: Record<string, Entry>): PublicAssetsLookup {
  // Request paths are new strings: a `Map` finds them faster than the keys of a large object
  let entries: Map<string, Entry> | undefined;
  // Directory request ids (`/docs`, `/`) to the id of their `index.html`
  let dirs: Map<string, string>;

  function load(): Map<string, Entry> {
    entries = new Map();
    dirs = new Map();
    for (const id in manifest) {
      entries.set(id, manifest[id]);
      if (id.endsWith("/index.html")) {
        const dir = id.slice(0, -"/index.html".length) || "/";
        dirs.set(dir, id);
        // A request that is not an asset then misses a single lookup
        if (!(dir in manifest)) {
          entries.set(dir, DIR);
        }
      }
    }
    return entries;
  }

  // Compressed copy requested by its own name (`/foo.css.br`), served as is. It runs for every
  // request that is not an asset, so the extensions of `ENCODING_EXTS` are inlined behind a check
  // of the position of their dot: a loop, or `endsWith` for each of them, is slower.
  function resolveCopy(id: string): ServedAsset | undefined {
    const n = id.length;
    const encoding =
      id.charCodeAt(n - 3) === 46 /* . */
        ? id.endsWith("br")
          ? "br"
          : id.endsWith("gz")
            ? "gzip"
            : undefined
        : id.charCodeAt(n - 4) === 46 && id.endsWith("zst")
          ? "zstd"
          : undefined;
    if (encoding) {
      const plainId = id.slice(0, -ENCODING_EXTS[encoding]!.length);
      const entry = entries!.get(plainId);
      return entry && serve(plainId, entry, encoding);
    }
  }

  return {
    hasAsset(id: string): boolean {
      return (entries || load()).has(id) || !!resolveCopy(id);
    },

    isAssetFile(id: string): boolean {
      return (entries || load()).get(id)?.etag !== undefined || !!resolveCopy(id);
    },

    hasEncodedVariants(id: string): boolean {
      const map = entries || load();
      return !!(map.get(id)?.variants || map.get(dirs.get(id)!)?.variants);
    },

    resolveAsset(id: string, encodings: readonly string[]): ServedAsset | undefined {
      const map = entries || load();
      const found = map.get(id);
      const entry = found === DIR ? undefined : found;
      const indexId = dirs.get(id);
      const index = indexId && map.get(indexId);
      for (const encoding of encodings) {
        const served =
          (entry && serve(id, entry, encoding)) ||
          (!encoding && resolveCopy(id)) ||
          (index && serve(indexId, index, encoding));
        if (served) {
          return served;
        }
      }
    },
  };
}

// Entry of a directory id that is not a file: it has no file and no variants to serve
const DIR = {} as Entry;

const lookup = createPublicAssetsLookup(assets as Record<string, Entry>);

export const hasAsset: PublicAssetsLookup["hasAsset"] = lookup.hasAsset;
export const isAssetFile: PublicAssetsLookup["isAssetFile"] = lookup.isAssetFile;
export const hasEncodedVariants: PublicAssetsLookup["hasEncodedVariants"] =
  lookup.hasEncodedVariants;
export const resolveAsset: PublicAssetsLookup["resolveAsset"] = lookup.resolveAsset;

// File of an entry for an encoding (`''` for its plain file), with the entry id to read it
function serve(id: string, entry: Entry, encoding: string): ServedAsset | undefined {
  if (!encoding) {
    return entry.etag === undefined
      ? undefined
      : (entry._served ??= { id, asset: entry as PublicAsset });
  }
  const ext = ENCODING_EXTS[encoding];
  const variant = ext && entry.variants?.[encoding];
  if (variant) {
    return (variant._served ??= {
      id,
      asset: {
        type: entry.type,
        encoding,
        etag: variant.etag,
        mtime: (variant.mtime ?? entry.mtime)!,
        size: variant.size,
        path: entry.path + ext,
      },
    });
  }
}
