import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { resolveModulePath } from "exsolve";
import { join } from "pathe";
import { describe, expect, it, vi } from "vitest";
import {
  applyProductionCondition,
  externals,
  findPackageParents,
  normalizeMatcher,
} from "../../src/rollup/plugins/externals";

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

describe("externals:findPackageParents", () => {
  it("retains known parents when a traced parent is missing from tracedFiles (#4803)", () => {
    const pkg = {
      name: "dependency",
      versions: {
        "1.0.0": {
          files: ["child"],
        },
      },
    };
    const tracedFiles = {
      child: {
        path: "child",
        parents: ["missing", "known"],
      },
      known: {
        path: "known",
        pkgName: "parent",
        pkgVersion: "2.0.0",
      },
    };

    const result = findPackageParents(pkg as any, "1.0.0", tracedFiles as any);
    expect(result).toEqual(["parent@2.0.0"]);
  });

  it("filters out parents belonging to the same package", () => {
    const pkg = {
      name: "dependency",
      versions: {
        "1.0.0": {
          files: ["child"],
        },
      },
    };
    const tracedFiles = {
      child: {
        path: "child",
        parents: ["sibling"],
      },
      sibling: {
        path: "sibling",
        pkgName: "dependency",
        pkgVersion: "1.0.0",
      },
    };

    const result = findPackageParents(pkg as any, "1.0.0", tracedFiles as any);
    expect(result).toEqual([]);
  });

  it("ignores parent files without a pkgName", () => {
    const pkg = {
      name: "dependency",
      versions: {
        "1.0.0": {
          files: ["child"],
        },
      },
    };
    const tracedFiles = {
      child: {
        path: "child",
        parents: ["app-entry", "known"],
      },
      "app-entry": {
        path: "app-entry",
        // No pkgName, e.g. root app file
      },
      known: {
        path: "known",
        pkgName: "parent",
        pkgVersion: "2.0.0",
      },
    };

    const result = findPackageParents(pkg as any, "1.0.0", tracedFiles as any);
    expect(result).toEqual(["parent@2.0.0"]);
  });

  it("handles missing version or files safely", () => {
    const pkg = {
      name: "dependency",
      versions: {},
    };
    const tracedFiles = {};

    expect(findPackageParents(pkg as any, "1.0.0", tracedFiles as any)).toEqual(
      []
    );
  });
});

describe("externals:buildEnd", () => {
  it("does not hoist a version whose only parents are untraced (#4803)", async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "nitro-externals-"))
    );
    const writePkg = async (dir: string, version: string, code: string) => {
      await mkdir(join(root, dir), { recursive: true });
      await writeFile(
        join(root, dir, "package.json"),
        JSON.stringify({
          name: dir.split("/").pop(),
          version,
          main: "index.js",
        })
      );
      await writeFile(join(root, dir, "index.js"), code);
    };
    try {
      // app -> dep@2 (direct) and app -> pkg-b -> dep@2
      await writePkg("node_modules/dep", "2.0.0", `module.exports = 2;`);
      await writePkg("node_modules/pkg-b", "1.0.0", `require("dep");`);
      // app -> pkg-a -> linked (symlink outside node_modules, untraced) -> dep@1
      await writePkg("node_modules/pkg-a", "1.0.0", `require("linked");`);
      await writePkg("linked", "1.0.0", `require("dep");`);
      await writePkg("linked/node_modules/dep", "1.0.0", `module.exports = 1;`);
      await symlink("../linked", join(root, "node_modules/linked"), "dir");

      const outDir = join(root, "out");
      const plugin = externals({
        outDir,
        rootDir: root,
        moduleDirectories: [],
        traceInclude: ["pkg-a", "pkg-b", "dep"].map((name) =>
          join(root, "node_modules", name, "index.js")
        ),
        traceOptions: { base: "/", processCwd: root },
      });
      await (plugin.buildEnd as any).call({
        resolve: async (id: string) => ({ id }),
      });

      const readVersion = async (dir: string) =>
        JSON.parse(await readFile(join(outDir, dir, "package.json"), "utf8"))
          .version;
      expect(await readVersion("node_modules/dep")).toBe("2.0.0");
      expect(await readVersion("node_modules/pkg-b/node_modules/dep")).toBe(
        "2.0.0"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
