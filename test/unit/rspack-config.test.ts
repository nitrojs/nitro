import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { NitroConfig } from "nitro/types";
import * as rspack from "@rspack/core";
import { build, createNitro, prepare } from "../../src/builder.ts";
import { getRspackConfig } from "../../src/build/rspack/config.ts";

// Real Rspack builds, run by the `rspack` CI job (not by `pnpm test`)
const isRspack = process.env.NITRO_BUILDER === "rspack";

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
    expect(config.optimization?.splitChunks).toBe(false);
  });

  it("uses `chunkFileNames` for library chunks too", async () => {
    const { config } = await rspackConfig({
      rollupConfig: { output: { chunkFileNames: "chunks/[name].mjs" } },
    });
    expect(config.output?.chunkFilename).toBe("chunks/[name].mjs");
    const splitChunks = config.optimization?.splitChunks as {
      cacheGroups: Record<string, { filename?: unknown }>;
    };
    expect(splitChunks.cacheGroups.libs!.filename).toBe("chunks/[name].mjs");
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

  it.skipIf(!isRspack)("applies `banner`, `footer`, `intro`, `outro` and `external`", async () => {
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

describe("rspack: rspackConfig", () => {
  it.each([
    ["an object", { "user-pkg": "user-pkg" }],
    ["a function", () => undefined],
  ])("keeps Nitro externals with `externals` as %s", async (_, externals) => {
    const { config } = await rspackConfig({ rspackConfig: { externals } });
    expect(config.externals).toEqual([externals, expect.any(Function)]);
  });

  it("concatenates `externals` arrays", async () => {
    const { config } = await rspackConfig({ rspackConfig: { externals: ["user-pkg"] } });
    expect(config.externals).toEqual(["user-pkg", expect.any(Function)]);
  });
});

describe.skipIf(!isRspack)("rspack: chunk file names", () => {
  it("names chunks like the other builders, without overwriting files", async () => {
    const rootDir = createApp({
      "profile.ts": `export default () => Promise.all([import("./a/utils.ts"), import("./b/utils.ts")]).then((m) => m.map((m) => m.default).join());`,
      "a/utils.ts": `export default "a";`,
      "b/utils.ts": `export default "b";`,
    });
    const nitro = await createNitro({
      rootDir,
      builder: "rspack",
      preset: "node",
      compatibilityDate: "latest",
      logLevel: 0,
      handlers: [{ route: "/users/:id/profile", handler: join(rootDir, "profile.ts"), lazy: true }],
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
    const serverDir = nitro.options.output.serverDir;
    const read = (file: string) => readFile(join(serverDir, file), "utf8");
    // `[id]` is a placeholder of Rspack file names
    const profile = await read("_routes/users/_id_/profile.mjs");
    expect(profile).toContain("import(");
    // Production chunk ids are not derived from module paths
    expect(profile).not.toMatch(/utils_ts/);
    const utils = await Promise.all([read("_chunks/utils.mjs"), read("_chunks/utils2.mjs")]);
    expect(utils.join()).toMatch(/"a"[\s\S]*"b"|"b"[\s\S]*"a"/);
  });
});
