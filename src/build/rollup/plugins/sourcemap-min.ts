import type { ExistingRawSourceMap, Plugin } from "rollup";

export function sourcemapMininify() {
  return {
    name: "nitro:sourcemap-minify",
    generateBundle(_options, bundle) {
      for (const [key, asset] of Object.entries(bundle)) {
        // Only process sourcemaps
        if (
          !key.endsWith(".map") ||
          !("source" in asset) ||
          typeof asset.source !== "string"
        ) {
          continue;
        }
        // Parse sourcemap
        const sourcemap: ExistingRawSourceMap = JSON.parse(asset.source);
        // Only process sourcemaps with node_module sources
        if (
          !(sourcemap.sources || []).some((s) => s.includes("node_modules"))
        ) {
          continue;
        }
        // TODO: Try to treeshake mappings instead
        sourcemap.mappings = "";
        asset.source = JSON.stringify(sourcemap);
      }
    },
  } satisfies Plugin;
}
