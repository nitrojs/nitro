import { describe, expect, it } from "vitest";
import { sourcemapMininify } from "../../src/rollup/plugins/sourcemap-min";

type BundleAsset = { type: "asset"; source: string };

function createSourcemapAsset(sourcemap: {
  sources?: string[];
  mappings?: string;
}): BundleAsset {
  return {
    type: "asset",
    source: JSON.stringify({
      version: 3,
      sources: [],
      mappings: "AAAA,CAAC",
      ...sourcemap,
    }),
  };
}

function runPlugin(bundle: Record<string, BundleAsset>) {
  const plugin = sourcemapMininify();
  const generateBundle = plugin.generateBundle as (
    this: unknown,
    options: Record<string, unknown>,
    bundle: Record<string, BundleAsset>
  ) => void;
  generateBundle.call(null, {}, bundle);
  const results: Record<string, ReturnType<typeof JSON.parse>> = {};
  for (const [key, asset] of Object.entries(bundle)) {
    if (key.endsWith(".map")) {
      results[key] = JSON.parse(asset.source);
    }
  }
  return results;
}

describe("sourcemapMininify", () => {
  it("wipes mappings for pure library chunks", () => {
    const bundle = {
      "_libs/express.mjs.map": createSourcemapAsset({
        sources: [
          "../../node_modules/express/index.js",
          "../../node_modules/express/lib/router.js",
        ],
        mappings: "AAAA,CAAC",
      }),
    };
    const results = runPlugin(bundle);
    expect(results["_libs/express.mjs.map"].mappings).toBe("");
  });

  it("preserves mappings for pure user code chunks", () => {
    const bundle = {
      "_routes/api/hello.mjs.map": createSourcemapAsset({
        sources: ["src/routes/api/hello.ts"],
        mappings: "AAAA,CAAC",
      }),
    };
    const results = runPlugin(bundle);
    expect(results["_routes/api/hello.mjs.map"].mappings).toBe("AAAA,CAAC");
  });

  it("preserves mappings when library is hoisted into user chunk", () => {
    const bundle = {
      "_routes/api/hello.mjs.map": createSourcemapAsset({
        sources: [
          "src/routes/api/hello.ts",
          "../../node_modules/some-lib/index.js",
        ],
        mappings: "AAAA,CAAC",
      }),
    };
    const results = runPlugin(bundle);
    expect(results["_routes/api/hello.mjs.map"].mappings).toBe("AAAA,CAAC");
  });

  it("skips non-sourcemap files", () => {
    const bundle = {
      "index.mjs": { type: "asset" as const, source: "console.log(42)" },
    };
    runPlugin(bundle as any);
    expect(bundle["index.mjs"].source).toBe("console.log(42)");
  });
});
