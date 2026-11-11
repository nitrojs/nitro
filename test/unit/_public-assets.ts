import type { Nitro } from "nitro/types";
import publicAssets from "../../src/build/virtual/public-assets.ts";
import { createPublicAssetsLookup } from "../../src/runtime/internal/public-assets.ts";
import type {
  PublicAssetsLookup as RuntimeLookup,
  ServedAsset,
} from "../../src/runtime/internal/public-assets.ts";

export type PublicAssetsLookup = RuntimeLookup & {
  isPublicAssetURL: (id: string) => boolean;
  isPublicAssetBaseURL: (id: string) => boolean;
};

const EXTS: Record<string, string> = { br: ".br", gzip: ".gz", zstd: ".zst" };
const ENCODINGS: Record<string, string> = { ".br": "br", ".gz": "gzip", ".zst": "zstd" };

// The lookup over a manifest built from files (`/foo.css.br` is the `br` variant of `/foo.css`),
// like the build does, with the `isPublicAssetURL` of the generated `#nitro/virtual/public-assets`
export function loadPublicAssets(
  files: Record<string, object>,
  { publicAssets: dirs = [] }: { publicAssets?: { baseURL: string }[] } = {}
): PublicAssetsLookup {
  const lookup = createPublicAssetsLookup(toManifest(files) as any);
  return {
    ...lookup,
    ...evalPublicAssets({ serveStatic: true, publicAssets: dirs }, { ...lookup }),
  };
}

// Evaluates the generated `#nitro/virtual/public-assets` with its imports as bindings
export function evalPublicAssets(
  options: { serveStatic: boolean; publicAssets?: { baseURL: string }[] },
  bindings: Record<string, unknown>
) {
  const nitro = { options: { baseURL: "/", publicAssets: [], ...options } } as unknown as Nitro;
  const template = publicAssets(nitro).find((t) => t.id === "#nitro/virtual/public-assets")!
    .template as () => string;
  const body = template()
    .replace(/^\s*(import|export \{).*$/gm, "")
    .replace(/^export /gm, "");
  return new Function(
    ...Object.keys(bindings),
    `${body}\nreturn { isPublicAssetURL, isPublicAssetBaseURL };`
  )(...Object.values(bindings));
}

// The file a resolved asset is read from
export function servedFile(served: ServedAsset | undefined): string | undefined {
  return served && served.id + (served.asset.encoding ? EXTS[served.asset.encoding] : "");
}

// The entry id and encoding a file is read with
export function readArgs(file: string): [string, string | undefined] {
  const ext = /\.(br|gz|zst)$/.exec(file)?.[0];
  return ext ? [file.slice(0, -ext.length), ENCODINGS[ext]] : [file, undefined];
}

function toManifest(files: Record<string, object>) {
  const manifest: Record<string, Record<string, any>> = {};
  for (const [file, meta] of Object.entries(files)) {
    const [id, encoding] = readArgs(file);
    const { type, encoding: _, ...rest } = meta as Record<string, any>;
    const entry = (manifest[id] ??= { type, path: id });
    if (encoding) {
      (entry.variants ??= {})[encoding] = rest;
    } else {
      Object.assign(entry, rest);
    }
  }
  // Like the build: variants share the `mtime` of their plain file
  for (const entry of Object.values(manifest)) {
    for (const variant of Object.values(entry.variants || {}) as Record<string, any>[]) {
      if (entry.mtime !== undefined) {
        delete variant.mtime;
      }
    }
  }
  return manifest;
}
