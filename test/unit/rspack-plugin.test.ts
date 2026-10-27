import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "pathe";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import type { Plugin } from "rollup";
import { LOADER_PATH, RollupPluginsHost } from "../../src/build/rspack/_plugin.ts";

describe("rspack: plugins host", () => {
  it("resolves unclaimed bare imports once per directory", async () => {
    const { pluginsHost, resolveSpy, warn } = createHost();
    const external = (request: string, issuer: string, dependencyType = "esm") =>
      pluginsHost.externals({ request, dependencyType, contextInfo: { issuer } } as any);

    expect(await external("unknown-pkg", "/app/server/a.ts")).toBe("unknown-pkg");
    expect(await external("unknown-pkg", "/app/server/b.ts")).toBe("unknown-pkg");
    expect(await external("unknown-pkg", "/app/server/b.ts", "commonjs")).toBe("unknown-pkg");
    // Once with `require` and once with `import` conditions
    expect(resolveSpy).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);

    expect(await external("unknown-pkg", "/app/other/c.ts")).toBe("unknown-pkg");
    expect(resolveSpy).toHaveBeenCalledTimes(4);
  });

  it("supports `emitFile`, `getModuleInfo` and the bundle hooks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nitro-rspack-"));
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(
      join(dir, "index.mjs"),
      `import "./dep.mjs";\nexport const lazy = () => import("./lazy.mjs");\n`
    );
    writeFileSync(join(dir, "dep.mjs"), `export const dep = 1;\n`);
    writeFileSync(join(dir, "lazy.mjs"), `export const lazy = 1;\n`);
    const id = (name: string) => join(dir, name);
    const refs: Record<string, string> = {};
    const results: Record<string, any> = {};
    const plugin: Plugin = {
      name: "test",
      buildStart() {
        refs.start = this.emitFile({ type: "asset", name: "start.txt", source: "start" });
        this.emitFile({ type: "asset", fileName: "delete-me.txt", source: "" });
      },
      transform(code, moduleId) {
        if (moduleId === id("dep.mjs")) {
          refs.transform = this.emitFile({ type: "asset", fileName: "dep.txt", source: "dep" });
        }
        return null;
      },
      buildEnd() {
        results.index = this.getModuleInfo(id("index.mjs"));
        results.dep = this.getModuleInfo(id("dep.mjs"));
        results.lazy = this.getModuleInfo(id("lazy.mjs"));
        expect(() => this.emitFile({ type: "chunk", id: "x" })).toThrow(/only supports/);
      },
      generateBundle(_opts, bundle) {
        results.fileNames = {
          start: this.getFileName(refs.start!),
          dep: this.getFileName(refs.transform!),
        };
        results.generated = Object.keys(bundle).sort();
        delete bundle["delete-me.txt"];
        const entry = bundle["index.mjs"] as {
          code: string;
          isEntry: boolean;
          moduleIds: string[];
        };
        results.entry = { isEntry: entry.isEntry, moduleIds: entry.moduleIds };
        entry.code += "\n// generated\n";
        this.emitFile({ type: "asset", fileName: "generated.txt", source: "generated" });
      },
      writeBundle(_opts, bundle) {
        results.written = Object.keys(bundle).sort();
        expect(() => this.emitFile({ type: "asset", fileName: "late.txt", source: "" })).toThrow(
          /once the bundle is written/
        );
      },
    };
    const pluginsHost = await build(dir, plugin);
    // Released once the compiler is closed (the loader finds hosts in a global map)
    expect((globalThis as any).__nitro_rspack_hosts__.has(pluginsHost.id)).toBe(false);
    expect(pluginsHost.compilation).toBeUndefined();

    expect(results.index).toMatchObject({
      id: id("index.mjs"),
      isEntry: true,
      importedIds: [id("dep.mjs")],
      dynamicallyImportedIds: [id("lazy.mjs")],
      meta: {},
    });
    expect(results.dep).toMatchObject({ isEntry: false, importers: [id("index.mjs")] });
    expect(results.lazy).toMatchObject({ dynamicImporters: [id("index.mjs")] });

    expect(results.fileNames).toEqual({
      start: expect.stringMatching(/^_assets\/start-\w{8}\.txt$/),
      dep: "dep.txt",
    });
    expect(results.generated).toEqual(
      [
        "_chunks/lazy_mjs.mjs",
        "delete-me.txt",
        "dep.txt",
        "index.mjs",
        results.fileNames.start,
      ].sort()
    );
    expect(results.entry).toEqual({
      isEntry: true,
      moduleIds: expect.arrayContaining([id("index.mjs")]),
    });
    expect(results.written).toEqual(
      [
        "_chunks/lazy_mjs.mjs",
        "dep.txt",
        "generated.txt",
        "index.mjs",
        results.fileNames.start,
      ].sort()
    );

    const outDir = join(dir, "out");
    expect(readdirSync(outDir).sort()).toEqual([
      "_assets",
      "_chunks",
      "dep.txt",
      "generated.txt",
      "index.mjs",
    ]);
    expect(readFileSync(join(outDir, results.fileNames.start), "utf8")).toBe("start");
    expect(readFileSync(join(outDir, "index.mjs"), "utf8")).toMatch(/\/\/ generated\n$/);
  });
});

function createNitro(rootDir: string) {
  const warn = vi.fn();
  const nitro = {
    hooks: { hookOnce: () => {} },
    logger: { warn },
    options: { rootDir, buildDir: resolve(rootDir, ".nitro"), dev: false, node: false },
  };
  return { nitro: nitro as any, warn };
}

function createHost() {
  const { nitro, warn } = createNitro("/app");
  const pluginsHost = new RollupPluginsHost(nitro, []);
  const resolveSpy = vi.fn((_ctx, _dir, _request, _resolveCtx, callback) => {
    callback(new Error("Not found"));
  });
  pluginsHost.compilation = {
    compiler: { resolverFactory: { get: () => ({ resolve: resolveSpy }) } },
  } as any;
  return { pluginsHost, resolveSpy, warn };
}

async function build(dir: string, plugin: Plugin) {
  const { rspack } = await import("@rspack/core");
  const pluginsHost = new RollupPluginsHost(createNitro(dir).nitro, [plugin]);
  const compiler = rspack({
    mode: "production",
    context: dir,
    target: "node22",
    entry: { index: join(dir, "index.mjs") },
    devtool: false,
    stats: "none",
    optimization: { minimize: false, chunkIds: "named" },
    output: {
      path: join(dir, "out"),
      module: true,
      filename: "index.mjs",
      chunkFilename: "_chunks/[name].mjs",
      library: { type: "module" },
      chunkFormat: "module",
      chunkLoading: "import",
    },
    module: {
      rules: [
        { test: /\.mjs$/, enforce: "pre", loader: LOADER_PATH, options: pluginsHost.loaderOptions },
      ],
    },
    plugins: [pluginsHost],
  });
  try {
    await new Promise<void>((resolve, reject) => {
      compiler.run((error, stats) => {
        if (error || stats?.hasErrors()) {
          reject(error || new Error(stats!.toString()));
        } else {
          resolve();
        }
      });
    });
  } finally {
    await new Promise((resolve) => compiler.close(resolve));
  }
  return pluginsHost;
}
