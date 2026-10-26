import type { ExistingRawSourceMap, Plugin } from "rollup";
import type { Nitro } from "nitro/types";

// Ids of virtual modules already namespaced by their own plugins
const VIRTUAL_PREFIX_RE = /(?:^|\/)(virtual:.+)$/;

/**
 * Whether `nitro:sourcemap` runs and removes `sourcesContent`, so the bundler can skip
 * generating it. Same conditions as the plugin's registration and its `minify` option.
 */
export function excludeSourcemapSources(nitro: Nitro): boolean {
  return (
    !!nitro.options.sourcemap &&
    !nitro.options.dev &&
    nitro.options.experimental.sourcemapMinify !== false
  );
}

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
        let changed = false;

        // Virtual modules have no file on disk. Bundlers emit their ids as (relative)
        // paths, making consumers warn about missing sources. Namespace them instead.
        const original = sourcemap.sources;
        if (original) {
          const sources = original.map((source) =>
            source ? virtualSource(source, virtualIds) : source
          );
          if (sources.some((source, i) => source !== original[i])) {
            sourcemap.sources = sources;
            changed = true;
          }
        }

        if (opts.minify) {
          // Remove sourcesContent
          if ("sourcesContent" in sourcemap) {
            delete sourcemap.sourcesContent;
            changed = true;
          }

          // Remove x_google_ignoreList
          if ("x_google_ignoreList" in sourcemap) {
            delete sourcemap.x_google_ignoreList;
            changed = true;
          }

          if (
            sourcemap.mappings !== "" &&
            (sourcemap.sources || []).every((s) => s?.includes("node_modules"))
          ) {
            sourcemap.mappings = ""; // required key
            changed = true;
          }
        }

        // Assigning `asset.source` hands the map back to the bundler, so leave unchanged maps alone
        if (changed) {
          asset.source = JSON.stringify(sourcemap);
        }
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
