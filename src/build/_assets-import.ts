// Ported from @hiogawa/vite-plugin-fullstack (MIT License, Copyright (c) 2024 Hiroshi Ogawa)

// `?assets` imports contract shared by the bundler integrations (no bundler imports here).

/** Default export of an `?assets` import, without `merge()`. */
export interface AssetsResult {
  entry?: string;
  js: { href: string }[];
  css: { href: string; "data-vite-dev-id"?: string }[];
}

/** Default export of an `?assets` import. */
export type ImportAssetsResult = AssetsResult & {
  merge(...args: AssetsResult[]): ImportAssetsResult;
};

/** Provides `mergeAssets()` to the generated `?assets` modules. */
export const ASSETS_RUNTIME_ID = "virtual:nitro-assets/runtime";

/** Resolved id of the `?assets` imports of client environments. */
export const ASSETS_EMPTY_ID = "\0virtual:nitro-assets/empty";

/**
 * Imported by the `?assets` modules of server builds (`__assets_manifest[env][key]`), kept external
 * and rewritten to the relative path of {@link ASSETS_MANIFEST_FILE}.
 */
export const ASSETS_MANIFEST_ID = "virtual:nitro-assets/manifest";

/** Written next to the server chunks importing {@link ASSETS_MANIFEST_ID}. */
export const ASSETS_MANIFEST_FILE = "__nitro_assets_manifest.js";

export const EMPTY_ASSETS: AssetsResult = { js: [], css: [] };

/** Code of the {@link ASSETS_RUNTIME_ID} module. */
export const ASSETS_RUNTIME_CODE = /* js */ `
export function mergeAssets(...args) {
  const raw = {
    entry: args.find((arg) => arg.entry)?.entry,
    js: uniqBy(args.flatMap((arg) => arg.js)),
    css: uniqBy(args.flatMap((arg) => arg.css)),
  };
  return { ...raw, merge: (...rest) => mergeAssets(raw, ...rest) };
}
function uniqBy(items) {
  const seen = new Set();
  return items.filter((item) => !seen.has(item.href) && seen.add(item.href));
}
`;

/** Manifest entry of an `?assets` import, by target environment and module key. */
export interface ManifestEntry {
  entry?: string | RuntimeURL;
  js: { href: string | RuntimeURL }[];
  css: { href: string | RuntimeURL }[];
}

/** An asset url computed at runtime (`experimental.renderBuiltUrl` result). */
export class RuntimeURL {
  code: string;
  constructor(code: string) {
    this.code = code;
  }
}

/** Code of the {@link ASSETS_MANIFEST_FILE} module. */
export function serializeAssetsManifest(
  manifest: Record<string, Record<string, ManifestEntry>>
): string {
  const runtimes: string[] = [];
  const json = JSON.stringify(
    manifest,
    (_key, v) =>
      v instanceof RuntimeURL ? `__nitro_assets_runtime_${runtimes.push(v.code) - 1}__` : v,
    2
  );
  return `export default ${json.replace(/"__nitro_assets_runtime_(\d+)__"/g, (_, i) => runtimes[Number(i)]!)};\n`;
}

export function parseIdQuery(id: string): {
  filename: string;
  query: Record<string, string | undefined>;
} {
  const index = id.indexOf("?");
  if (index === -1) {
    return { filename: id, query: {} };
  }
  return {
    filename: id.slice(0, index),
    query: Object.fromEntries(new URLSearchParams(id.slice(index + 1))),
  };
}
