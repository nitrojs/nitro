import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import type { PluginContext, ResolveIdHook } from "rollup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyProductionCondition,
  externals,
} from "../../src/rollup/plugins/externals";
import { externals as legacyExternals } from "../../src/rollup/plugins/externals-legacy";

describe.each([
  ["default", externals],
  ["legacy", legacyExternals],
] as const)("externals:comment syntax (%s)", (_name, createExternals) => {
  let root: string;
  let entry: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "nitro-comment-syntax-"));
    const packageDir = join(root, "node_modules", "comment-syntax");
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      join(packageDir, "package.json"),
      JSON.stringify({ name: "comment-syntax", main: "index.js" })
    );
    entry = join(packageDir, "index.js");
    await writeFile(
      entry,
      "/* export default example */\nmodule.exports = 42;"
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("externalizes CommonJS with ESM-looking comments", async () => {
    const plugin = createExternals({
      outDir: join(root, "output"),
      moduleDirectories: [join(root, "node_modules")],
      trace: false,
    });
    const result = await (plugin.resolveId as ResolveIdHook).call(
      { resolve: async () => ({ id: entry }) } as unknown as PluginContext,
      "comment-syntax",
      join(root, "entry.mjs"),
      { isEntry: false, attributes: {} }
    );
    expect(result).toMatchObject({ external: true });
  });

  it("preserves explicit inlining", async () => {
    const plugin = createExternals({
      outDir: join(root, "output"),
      inline: ["comment-syntax"],
      trace: false,
    });
    const result = await (plugin.resolveId as ResolveIdHook).call(
      { resolve: async () => ({ id: entry }) } as unknown as PluginContext,
      "comment-syntax",
      join(root, "entry.mjs"),
      { isEntry: false, attributes: {} }
    );
    expect(result).toBeNull();
  });

  it("still bundles invalid CommonJS containing real ESM syntax", async () => {
    const mixed = join(root, "node_modules", "comment-syntax", "mixed.js");
    await writeFile(mixed, "module.exports = {};\nexport const value = 42;");
    const plugin = createExternals({
      outDir: join(root, "output"),
      trace: false,
    });
    const result = await (plugin.resolveId as ResolveIdHook).call(
      { resolve: async () => ({ id: mixed }) } as unknown as PluginContext,
      "comment-syntax/mixed",
      join(root, "entry.mjs"),
      { isEntry: false, attributes: {} }
    );
    expect(result).toBeNull();
  });
});

describe("externals:applyProductionCondition", () => {
  const applyProductionConditionCases = [
    {
      name: "vue-router@4.1.6",
      in: {
        ".": {
          types: "./dist/vue-router.d.ts",
          node: {
            import: {
              production: "./dist/vue-router.node.mjs",
              development: "./dist/vue-router.node.mjs",
              default: "./dist/vue-router.node.mjs",
            },
            require: {
              production: "./dist/vue-router.prod.cjs",
              development: "./dist/vue-router.cjs",
              default: "./index.js",
            },
          },
          import: "./dist/vue-router.mjs",
          require: "./index.js",
        },
        "./dist/*": "./dist/*",
        "./vetur/*": "./vetur/*",
        "./package.json": "./package.json",
      },
      out: {
        ".": {
          types: "./dist/vue-router.d.ts",
          node: {
            import: {
              production: "./dist/vue-router.node.mjs",
              development: "./dist/vue-router.node.mjs",
              default: "./dist/vue-router.node.mjs",
            },
            require: {
              production: "./dist/vue-router.prod.cjs",
              development: "./dist/vue-router.cjs",
              default: "./dist/vue-router.prod.cjs",
            },
          },
          import: "./dist/vue-router.mjs",
          require: "./index.js",
        },
        "./dist/*": "./dist/*",
        "./vetur/*": "./vetur/*",
        "./package.json": "./package.json",
      },
    },
    {
      name: "fluent-vue@3.2.0",
      in: {
        ".": {
          production: {
            require: "./dist/prod/index.cjs",
            import: "./dist/prod/index.mjs",
          },
          types: "./index.d.ts",
          require: "./dist/index.cjs",
          import: "./dist/index.mjs",
        },
      },
      out: {
        ".": {
          import: "./dist/prod/index.mjs",
          production: {
            import: "./dist/prod/index.mjs",
            require: "./dist/prod/index.cjs",
          },
          require: "./dist/prod/index.cjs",
          types: "./index.d.ts",
        },
      },
    },
  ];
  for (const t of applyProductionConditionCases) {
    it(t.name, () => {
      applyProductionCondition(t.in as any);
      expect(t.in).toEqual(t.out);
    });
  }
});
