import type { ExistingRawSourceMap, Plugin } from "rollup";

export function sourcemapMinify() {
  return {
    name: "nitro:sourcemap-minify",
    generateBundle(_options, bundle) {
      for (const [key, asset] of Object.entries(bundle)) {
        // Only process sourcemaps
        if (!key.endsWith(".map") || !("source" in asset) || typeof asset.source !== "string") {
          continue;
        }

        // Parse sourcemap
        const sourcemap: ExistingRawSourceMap = JSON.parse(asset.source);

        // Remove sourcesContent
        delete sourcemap.sourcesContent;

        // Remove x_google_ignoreList
        delete sourcemap.x_google_ignoreList;

        if ((sourcemap.sources || []).some((s) => s.includes("node_modules"))) {
          sourcemap.mappings = ""; // required key
        }

        asset.source = JSON.stringify(sourcemap);
      }
    },
  } satisfies Plugin;
}
