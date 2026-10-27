import type {
  Compilation,
  Compiler,
  ExternalItemFunctionData,
  LoaderContext,
  RspackPluginInstance,
} from "@rspack/core";
import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { join } from "pathe";
import { runtimeDir } from "#nitro/meta";
import { PluginHost } from "./_host.ts";
import { VirtualPlaceholders } from "./_virtual.ts";
import { chainSourceMaps } from "./_sourcemap.ts";
import { writeAsset } from "./_bundle.ts";
import { getModuleInfo } from "./_modules.ts";
import { generateBundle, renderChunks, writeBundle } from "./_output.ts";
import { ModuleResolver } from "./_resolve.ts";
import type { AssetSource } from "./_files.ts";
import type { HookSourceMap, RawSourceMap, SourceMapStep } from "./_sourcemap.ts";

const NAME = "nitro:rollup-plugins";

/** Loader running the `load` and `transform` hooks (see `runtime/internal/rspack/loader.mjs`). */
export const LOADER_PATH: string = join(runtimeDir, "internal/rspack/loader.mjs");

// Shared with the loader, which is loaded by Rspack from a separate file
const hosts: Map<string, RollupPluginsHost> = ((globalThis as any).__nitro_rspack_hosts__ ??=
  new Map());

let nextId = 0;

/**
 * Rspack plugin running Nitro's build plugins (Rollup plugin interface):
 * - `resolveId` before Rspack resolves a request (virtual modules, externals, aliases).
 * - `load` and `transform` with a pre-loader (virtual modules are loaded from placeholder files).
 * - `buildStart`, `buildEnd` (once all modules are built) and `renderChunk` (on emitted chunks).
 * - `generateBundle` (on the compilation assets) and `writeBundle` (once they are written).
 */
export class RollupPluginsHost implements RspackPluginInstance {
  readonly id: string;
  readonly host: PluginHost;
  readonly virtual: VirtualPlaceholders;
  readonly resolver: ModuleResolver;
  compilation?: Compilation;
  /** Assets emitted by plugins before the compilation processes its assets. */
  pendingAssets = new Map<string, AssetSource>();
  /** Compilation processing its assets (plugins emit assets to it directly). */
  assetsCompilation?: Compilation;
  /** Whether the assets of the current compilation are written. */
  assetsWritten = false;

  constructor(nitro: Nitro, plugins: Plugin[], opts: { externals?: string[] } = {}) {
    this.id = String(nextId++);
    hosts.set(this.id, this);
    nitro.hooks.hookOnce("close", () => {
      hosts.delete(this.id);
    });
    this.virtual = new VirtualPlaceholders(join(nitro.options.buildDir, "rspack/virtual"));
    this.host = new PluginHost(nitro, plugins, {
      resolve: (source, importer, kind) => this.resolver.resolveWithRspack(source, importer, kind),
      getModuleIds: () => this.moduleIds(),
      getModuleInfo: (id) =>
        this.compilation ? getModuleInfo(this.compilation, id, (r) => this.virtual.toId(r)) : null,
      emitAsset: (fileName, source) => this.emitAsset(fileName, source),
    });
    this.resolver = new ModuleResolver({
      host: this.host,
      virtual: this.virtual,
      compilation: () => this.compilation,
      externals: opts.externals,
    });
  }

  /** Loader rule options, for the pre-loader to find this instance. */
  get loaderOptions() {
    return { host: this.id };
  }

  apply(compiler: Compiler) {
    compiler.hooks.beforeCompile.tapPromise(NAME, () => {
      this.assetsCompilation = undefined;
      this.assetsWritten = false;
      return this.host.buildStart();
    });
    compiler.hooks.done.tapPromise(NAME, () => this.host.closeBundle());
    const toId = (resource: string) => this.virtual.toId(resource);
    compiler.hooks.afterEmit.tapPromise(NAME, async (compilation) => {
      this.assetsWritten = true;
      await writeBundle(this.host, compilation, toId);
    });

    const { Compilation } = compiler.rspack;
    compiler.hooks.thisCompilation.tap(NAME, (compilation) => {
      this.compilation = compilation;
      this.resolver.clear();
      compilation.hooks.finishModules.tapPromise(NAME, () => this.host.buildEnd());
      compilation.hooks.processAssets.tap(
        { name: NAME, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          this.assetsCompilation = compilation;
          for (const [fileName, source] of this.pendingAssets) {
            writeAsset(compilation, fileName, source);
          }
          this.pendingAssets.clear();
        }
      );
      // After minification and before source maps are emitted
      compilation.hooks.processAssets.tapPromise(
        { name: NAME, stage: Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING - 1 },
        () => renderChunks(this.host, compilation)
      );
      if (this.host.hooks.generateBundle.length > 0) {
        compilation.hooks.processAssets.tapPromise(
          { name: NAME, stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE },
          () => generateBundle(this.host, compilation, toId)
        );
      }
    });

    compiler.hooks.normalModuleFactory.tap(NAME, (nmf) => {
      nmf.hooks.beforeResolve.tapPromise(NAME, async (data) => {
        if (data.request.includes("!")) {
          return;
        }
        const issuer = data.contextInfo.issuer;
        const resolved = await this.resolver.resolve(data.request, issuer);
        if (!resolved) {
          // Bare and relative imports of virtual modules resolve from the root directory
          if (issuer && this.virtual.isVirtual(issuer)) {
            data.context = this.host.nitro.options.rootDir;
          }
          return;
        }
        if (!resolved.external) {
          data.request = this.virtual.toRequest(resolved.id);
        }
      });
    });
  }

  /** `externals` function: externals resolved by the build plugins. */
  externals(data: ExternalItemFunctionData): Promise<string | string[] | undefined> {
    return this.resolver.externals(data);
  }

  /** Runs the `load` and `transform` hooks for a module (called by the pre-loader). */
  async runLoader(
    loader: LoaderContext,
    code: string,
    inputMap?: HookSourceMap
  ): Promise<{ code: string; map?: HookSourceMap | RawSourceMap }> {
    const id = this.virtual.toId(loader.resource);
    const ctxOpts = {
      addWatchFile: (file: string) => loader.addDependency(file),
      emitAsset: (fileName: string, source: AssetSource) =>
        loader.emitFile(fileName, typeof source === "string" ? source : Buffer.from(source)),
    };
    const loaded = await this.host.load(id, ctxOpts);
    if (loaded == null && id !== loader.resource) {
      throw new Error(`Could not load virtual module \`${id}\`.`);
    }
    const maps: SourceMapStep[] | undefined = loader.sourceMap ? [] : undefined;
    const transformed = await this.host.transform(loaded?.code ?? code, id, ctxOpts, maps);
    const map = loaded ? loaded.map : inputMap;
    if (!maps?.length) {
      return { code: transformed, map: maps && map };
    }
    const sources = this.compilation!.compiler.rspack.sources;
    return {
      code: transformed,
      map: chainSourceMaps(sources, { name: loader.resourcePath, map, steps: maps }),
    };
  }

  /** Emits an asset to the compilation processing its assets (or to the next one). */
  emitAsset(fileName: string, source: AssetSource) {
    if (this.assetsWritten) {
      throw new Error("Cannot emit files once the bundle is written.");
    }
    if (this.assetsCompilation) {
      writeAsset(this.assetsCompilation, fileName, source);
    } else {
      this.pendingAssets.set(fileName, source);
    }
  }

  *moduleIds(): Iterable<string> {
    for (const module of this.compilation?.modules || []) {
      const resource = (module as { resource?: string }).resource;
      if (resource) {
        yield this.virtual.toId(resource);
      }
    }
  }
}
