import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { NitroConfig } from "nitro/types";
import * as rspack from "@rspack/core";
import { build, createNitro, prepare } from "../../src/builder.ts";
import { getRspackConfig } from "../../src/build/rspack/config.ts";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createApp(files: Record<string, string> = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-rspack-config-"));
  tmpDirs.push(rootDir);
  for (const [path, contents] of Object.entries({
    "package.json": JSON.stringify({ type: "module" }),
    ...files,
  })) {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true });
    writeFileSync(join(rootDir, path), contents);
  }
  return rootDir;
}

async function rspackConfig(config: NitroConfig) {
  const nitro = await createNitro({
    rootDir: createApp(),
    builder: "rspack",
    compatibilityDate: "latest",
    ...config,
  });
  const warn = vi.spyOn(nitro.logger, "warn").mockImplementation(() => {});
  const result = await getRspackConfig(nitro, rspack);
  await nitro.close();
  return { config: result, warnings: warn.mock.calls.map((call) => String(call[0])) };
}

describe("rspack: rollupConfig options", () => {
  it("maps output file names, code splitting and source map options", async () => {
    const { config, warnings } = await rspackConfig({
      sourcemap: true,
      rollupConfig: {
        output: {
          entryFileNames: "server.mjs",
          chunkFileNames: "chunks/[name]-[hash].mjs",
          inlineDynamicImports: true,
          sourcemapExcludeSources: false,
          exports: "named",
        },
      },
    });
    expect(config.output).toMatchObject({
      filename: "server.mjs",
      chunkFilename: "chunks/[name]-[contenthash:8].mjs",
      asyncChunks: false,
    });
    expect(config.devtool).toBe("source-map");
    expect(warnings).toEqual([]);
  });

  it("prefers `rolldownConfig` over `rollupConfig`", async () => {
    const { config } = await rspackConfig({
      rollupConfig: { output: { entryFileNames: "a.mjs" } },
      rolldownConfig: { output: { entryFileNames: "b.mjs" } },
    });
    expect(config.output).toMatchObject({ filename: "b.mjs" });
  });

  it("keeps dynamic imports inlined when Nitro inlines them (worker presets)", async () => {
    const { config } = await rspackConfig({
      inlineDynamicImports: true,
      rollupConfig: { output: { inlineDynamicImports: false } },
    });
    expect(config.output).toMatchObject({ asyncChunks: false });
  });

  it("warns about options that are not supported", async () => {
    const { warnings } = await rspackConfig({
      rollupConfig: {
        treeshake: false,
        output: { format: "iife", assetFileNames: "[name].[ext]", chunkFileNames: () => "x.mjs" },
      },
    });
    expect(warnings).toHaveLength(1);
    for (const key of [
      "treeshake",
      "output.assetFileNames",
      "output.format",
      "output.chunkFileNames",
    ]) {
      expect(warnings[0]).toContain(`\`${key}\``);
    }
  });

  it("applies `banner`, `footer`, `intro`, `outro` and `external`", async () => {
    const rootDir = createApp({
      "server.ts": [
        `import value from "external-pkg";`,
        `import remote from "https://example.com/mod.js";`,
        `export default { fetch: () => new Response(String([value, remote])) };`,
      ].join("\n"),
    });
    const nitro = await createNitro({
      rootDir,
      builder: "rspack",
      preset: "node",
      compatibilityDate: "latest",
      logLevel: 0,
      rollupConfig: {
        external: (id) => id.startsWith("https://"),
        output: {
          banner: "/* banner */",
          intro: "/* intro */",
          footer: (chunk) => `/* footer ${chunk.fileName} */`,
          outro: "/* outro */",
        },
      },
      rolldownConfig: { external: ["external-pkg"] },
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
    const code = await readFile(join(nitro.options.output.serverDir, "index.mjs"), "utf8");
    // `renderChunk` hooks (prepending `__nitro_main__`) run after banners, like with Rollup
    expect(code).toMatch(/^[^\n]*\/\* banner \*\/\n\/\* intro \*\/\n/);
    expect(code.trimEnd()).toMatch(
      /\/\* outro \*\/\n\/\* footer index\.mjs \*\/(\n\/\/# sourceMappingURL=.*)?$/
    );
    expect(code).toMatch(/from ["']external-pkg["']/);
    expect(code).toMatch(/from ["']https:\/\/example\.com\/mod\.js["']/);
  });
});
