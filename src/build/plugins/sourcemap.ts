import type { ExistingRawSourceMap, Plugin } from "rollup";

// Ids of virtual modules already namespaced by their own plugins
const VIRTUAL_PREFIX_RE = /(?:^|\/)(virtual:.+)$/;

export function sourcemap(opts: { virtualIds: Iterable<string>; minify: boolean }): Plugin {
  const virtualIds = [...opts.virtualIds];

  return {
    name: "nitro:sourcemap",
    generateBundle(_options, bundle) {
      for (const [key, asset] of Object.entries(bundle)) {
        // Only process sourcemaps
        if (!key.endsWith(".map") || !("source" in asset) || typeof asset.source !== "string") {
          continue;
        }

        // Parse sourcemap
        const sourcemap: ExistingRawSourceMap = JSON.parse(asset.source);

        // Virtual modules have no file on disk. Bundlers emit their ids as (relative)
        // paths, making consumers warn about missing sources. Namespace them instead.
        if (sourcemap.sources) {
          sourcemap.sources = sourcemap.sources.map((source) =>
            source ? virtualSource(source, virtualIds) : source
          );
        }

        if (opts.minify) {
          // Remove sourcesContent
          delete sourcemap.sourcesContent;

          // Remove x_google_ignoreList
          delete sourcemap.x_google_ignoreList;

          if ((sourcemap.sources || []).every((s) => s?.includes("node_modules"))) {
            sourcemap.mappings = ""; // required key
          }
        }

        asset.source = JSON.stringify(sourcemap);
      }
    },
  };
}

function virtualSource(source: string, virtualIds: string[]): string {
  const namespaced = VIRTUAL_PREFIX_RE.exec(source)?.[1];
  if (namespaced) {
    return namespaced;
  }
  for (const id of virtualIds) {
    if (source === id || source.endsWith(`/${id}`)) {
      return `virtual:${id}`;
    }
  }
  return source;
}
