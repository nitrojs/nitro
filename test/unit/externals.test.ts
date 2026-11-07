import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveModulePath } from "exsolve";
import { describe, expect, it, vi } from "vitest";
import {
  applyProductionCondition,
  externals,
  normalizeMatcher,
} from "../../src/rollup/plugins/externals";
import { externals as legacyExternals } from "../../src/rollup/plugins/externals-legacy";

vi.mock("node:url", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:url")>();
  return {
    ...mod,
    fileURLToPath: (url: string | URL) =>
      mod.fileURLToPath(url).replaceAll("/", "\\"),
  };
});

describe("externals:resolveId", () => {
  it("externalizes absolute package entries with windows separators", async () => {
    const plugin = externals({
      outDir: "",
      moduleDirectories: [],
      exportConditions: ["node", "import", "default"],
    });
    const entry = resolveModulePath("defu", { from: import.meta.url });
    const result = await (plugin.resolveId as any).call(
      { resolve: () => null },
      entry,
      fileURLToPath(import.meta.url),
      {}
    );
    expect(result).toEqual({ id: "defu", external: true });
  });
});

describe("externals:normalizeMatcher", () => {
  it("matches string patterns against posix ids", () => {
    const matcher = normalizeMatcher("nuxt/dist");
    expect(
      matcher("/project/node_modules/nuxt/dist/runtime/server/index.js")
    ).toBe(true);
    expect(matcher("/project/node_modules/nuxt/index.js")).toBe(false);
  });

  it("matches string patterns against windows ids", () => {
    const matcher = normalizeMatcher("nuxt/dist");
    expect(
      matcher(
        "D:\\project\\node_modules\\nuxt\\dist\\runtime\\server\\index.js"
      )
    ).toBe(true);
    expect(matcher("D:\\project\\node_modules\\nuxt\\index.js")).toBe(false);
  });

  it("matches absolute string patterns against windows ids", () => {
    const matcher = normalizeMatcher("D:\\project\\node_modules");
    expect(matcher("D:\\project\\node_modules\\vue\\index.js")).toBe(true);
    expect(matcher("D:\\other\\node_modules\\vue\\index.js")).toBe(false);
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

function createPackage(files: Record<string, string>): {
  root: string;
  entry: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nitro-externals-"));
  const pkgDir = path.join(root, "node_modules", "comment-syntax");
  fs.mkdirSync(pkgDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(pkgDir, name), content);
  }
  return { root, entry: path.join(pkgDir, "index.js") };
}

const externalsImplementations = [
  ["externals", externals],
  ["externals-legacy", legacyExternals],
] as const;

describe.each(externalsImplementations)(
  "%s: comment syntax in CommonJS entries",
  (_name, factory) => {
    it("externalizes a CJS entry that only mentions ESM syntax in a comment", async () => {
      const { root, entry } = createPackage({
        "package.json": JSON.stringify({
          name: "comment-syntax",
          version: "1.0.0",
          main: "index.js",
        }),
        "index.js": "/* export default example */\nmodule.exports = 42;\n",
      });
      const plugin = factory({
        outDir: "",
        moduleDirectories: [],
        exportConditions: ["node", "import", "default"],
        trace: false,
      } as any);
      const result = await (plugin.resolveId as any).call(
        { resolve: () => null },
        entry,
        path.join(root, "server.mjs"),
        {}
      );
      expect(result).toMatchObject({ external: true });
    });

    it("still inlines an entry with real mixed ESM and CJS syntax", async () => {
      const { root, entry } = createPackage({
        "package.json": JSON.stringify({
          name: "comment-syntax",
          version: "1.0.0",
          main: "index.js",
        }),
        "index.js": "export default 1;\nmodule.exports = 2;\n",
      });
      const plugin = factory({
        outDir: "",
        moduleDirectories: [],
        exportConditions: ["node", "import", "default"],
        trace: false,
      } as any);
      const result = await (plugin.resolveId as any).call(
        { resolve: () => null },
        entry,
        path.join(root, "server.mjs"),
        {}
      );
      expect(result).toBeNull();
    });
  }
);
