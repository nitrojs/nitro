import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import type { NitroConfig } from "nitro/types";
import { createNitro } from "../../src/nitro.ts";
import { sourcemap } from "../../src/build/plugins/sourcemap.ts";
import { getRolldownConfig } from "../../src/build/rolldown/config.ts";
import { getBundlerConfig } from "../../src/build/vite/bundler.ts";
import type { NitroPluginContext } from "../../src/build/vite/types.ts";

type BundleAsset = { type: "asset"; source: string };

function createSourcemapAsset(sourcemap: {
  sources?: string[];
  sourcesContent?: string[];
  mappings?: string;
  x_google_ignoreList?: number[];
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

function runPlugin(
  bundle: Record<string, BundleAsset>,
  opts: { virtualIds?: string[]; minify?: boolean } = {}
) {
  const plugin = sourcemap({
    virtualIds: opts.virtualIds || [],
    minify: opts.minify ?? true,
  });
  (plugin.generateBundle as Function).call(null, {}, bundle);
  const results: Record<string, ReturnType<typeof JSON.parse>> = {};
  for (const [key, asset] of Object.entries(bundle)) {
    if (key.endsWith(".map")) {
      results[key] = JSON.parse(asset.source);
    }
  }
  return results;
}

describe("sourcemap", () => {
  it("removes sourcesContent from all sourcemaps", () => {
    const bundle = {
      "index.mjs.map": createSourcemapAsset({
        sources: ["src/index.ts"],
        sourcesContent: ["export default 42;"],
      }),
    };
    const results = runPlugin(bundle);
    expect(results["index.mjs.map"].sourcesContent).toBeUndefined();
  });

  it("removes x_google_ignoreList from all sourcemaps", () => {
    const bundle = {
      "index.mjs.map": createSourcemapAsset({
        sources: ["src/index.ts"],
        x_google_ignoreList: [0],
      }),
    };
    const results = runPlugin(bundle);
    expect(results["index.mjs.map"].x_google_ignoreList).toBeUndefined();
  });

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
        sources: ["src/routes/api/hello.ts", "../../node_modules/some-lib/index.js"],
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

  it("handles empty sources array", () => {
    const bundle = {
      "chunk.mjs.map": createSourcemapAsset({
        sources: [],
        mappings: "AAAA,CAAC",
      }),
    };
    const results = runPlugin(bundle);
    expect(results["chunk.mjs.map"].mappings).toBe("");
  });

  it("namespaces virtual module sources", () => {
    const bundle = {
      "_chunks/app.mjs.map": createSourcemapAsset({
        sources: [
          "../../../../workspace/app/#nitro/virtual/app",
          "../../../../workspace/app/#virtual-route",
          "../../../../workspace/app/virtual:nitro:raw:/workspace/app/server/files/test.txt.js",
          "../../src/routes/index.ts",
        ],
      }),
    };
    const results = runPlugin(bundle, {
      virtualIds: ["#nitro/virtual/app", "#virtual-route"],
    });
    expect(results["_chunks/app.mjs.map"].sources).toEqual([
      "virtual:#nitro/virtual/app",
      "virtual:#virtual-route",
      "virtual:nitro:raw:/workspace/app/server/files/test.txt.js",
      "../../src/routes/index.ts",
    ]);
  });

  it("keeps sourcesContent when minify is disabled", () => {
    const bundle = {
      "index.mjs.map": createSourcemapAsset({
        sources: ["../../workspace/app/#nitro/virtual/app"],
        sourcesContent: ["export default 42;"],
      }),
    };
    const results = runPlugin(bundle, {
      virtualIds: ["#nitro/virtual/app"],
      minify: false,
    });
    expect(results["index.mjs.map"].sourcesContent).toEqual(["export default 42;"]);
    expect(results["index.mjs.map"].sources).toEqual(["virtual:#nitro/virtual/app"]);
  });

  it("leaves unchanged sourcemaps alone", () => {
    const source = JSON.stringify({
      version: 3,
      sources: ["../../src/routes/index.ts"],
      mappings: "AAAA,CAAC",
    });
    let writes = 0;
    const asset = {
      type: "asset" as const,
      get source() {
        return source;
      },
      set source(_value: string) {
        writes++;
      },
    };
    runPlugin({ "_routes/index.mjs.map": asset }, { minify: true });
    runPlugin({ "_routes/index.mjs.map": asset }, { minify: false });
    expect(writes).toBe(0);
  });
});

describe("sourcemapExcludeSources", () => {
  const excludeSources = async (config: NitroConfig) => {
    const nitro = await createNitro({
      rootDir: mkdtempSync(join(tmpdir(), "nitro-sourcemap-")),
      compatibilityDate: "latest",
      ...config,
    });
    const rolldown = await getRolldownConfig(nitro);
    const { rolldownConfig } = await getBundlerConfig({
      nitro,
      _isRolldown: true,
    } as unknown as NitroPluginContext);
    return [
      (rolldown.output as { sourcemapExcludeSources?: boolean }).sourcemapExcludeSources,
      rolldownConfig!.output!.sourcemapExcludeSources,
    ];
  };

  it("leaves out sourcesContent when nitro:sourcemap would remove it", async () => {
    expect(await excludeSources({ sourcemap: true })).toEqual([true, true]);
  });

  it("keeps sourcesContent otherwise", async () => {
    for (const config of [
      { sourcemap: false },
      { sourcemap: true, experimental: { sourcemapMinify: false } },
    ] satisfies NitroConfig[]) {
      expect((await excludeSources(config)).map(Boolean)).toEqual([false, false]);
    }
  });

  it("keeps an explicit value from user config", async () => {
    const config: NitroConfig = {
      sourcemap: true,
      experimental: { sourcemapMinify: false },
      rolldownConfig: { output: { sourcemapExcludeSources: true } },
    };
    expect(await excludeSources(config)).toEqual([true, true]);
  });
});
