import { describe, expect, it } from "vitest";
import {
  applyProductionCondition,
  normalizeMatcher,
} from "../../src/rollup/plugins/externals";

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

describe("externals:resolution", () => {
  async function build(
    entry: string,
    extra: { external?: string[]; traceInclude?: string[] }
  ) {
    const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("pathe");
    const { rollup } = await import("rollup");
    const { default: commonjs } = await import("@rollup/plugin-commonjs");
    const { nodeResolve } = await import("@rollup/plugin-node-resolve");
    const { externals } = await import("../../src/rollup/plugins/externals");

    const root = await mkdtemp(join(tmpdir(), "nitro-externals-"));
    const pkgDir = join(root, "node_modules", "ext-pkg");
    await mkdir(join(pkgDir, "sub"), { recursive: true });
    await mkdir(join(root, ".output"), { recursive: true });
    await writeFile(
      join(pkgDir, "package.json"),
      JSON.stringify({
        name: "ext-pkg",
        version: "1.0.0",
        exports: {
          ".": "./index.js",
          // Rollup's node-resolve and the Node.js resolver pick different files
          "./sub": { node: "./sub/node.js", default: "./sub/index.js" },
        },
      })
    );
    await writeFile(join(pkgDir, "index.js"), `module.exports = 1;`);
    await writeFile(
      join(pkgDir, "sub", "index.js"),
      `module.exports = require("../sentinel.js");`
    );
    await writeFile(
      join(pkgDir, "sub", "node.js"),
      `module.exports = require("../sentinel.js");`
    );
    await writeFile(join(pkgDir, "sentinel.js"), `module.exports = 42;`);
    await writeFile(join(root, "entry.js"), entry);

    const moduleIds: string[] = [];
    try {
      const bundle = await rollup({
        input: join(root, "entry.js"),
        plugins: [
          externals({
            outDir: join(root, ".output"),
            moduleDirectories: [join(root, "node_modules")],
            trace: true,
            ...extra,
          }),
          nodeResolve({ modulePaths: [join(root, "node_modules")] }),
          commonjs(),
          {
            name: "probe",
            moduleParsed(info) {
              moduleIds.push(info.id);
            },
          },
        ],
      });
      const { output } = await bundle.generate({ format: "esm" });
      await bundle.close();
      const { existsSync } = await import("node:fs");
      const traced = existsSync(
        join(root, ".output/node_modules/ext-pkg/sub/node.js")
      );
      return { moduleIds, code: output[0].code, traced };
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  const loadedFromPkg = (ids: string[]) =>
    ids.filter((id) => id.includes("node_modules/ext-pkg/"));

  it("does not load explicit externals into the module graph", async () => {
    const { moduleIds, code, traced } = await build(
      `import value from "ext-pkg/sub";\nexport default value;`,
      { external: ["ext-pkg"] }
    );
    expect(code).toContain(`from 'ext-pkg/sub'`);
    expect(traced).toBe(true);
    expect(loadedFromPkg(moduleIds)).toEqual([]);
  });

  it("does not load traceInclude entries into the module graph", async () => {
    const { moduleIds, traced } = await build(`export default 1;`, {
      traceInclude: ["ext-pkg/sub"],
    });
    expect(traced).toBe(true);
    expect(loadedFromPkg(moduleIds)).toEqual([]);
  });
});
