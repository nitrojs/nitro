import type {
  Compilation,
  Compiler,
  ExternalItemFunctionData,
  LoaderContext,
  RspackPluginInstance,
} from "@rspack/core";
import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "pathe";
import { runtimeDir } from "#nitro/meta";
import { PluginHost } from "./_host.ts";
import { VirtualPlaceholders } from "./_virtual.ts";
import { chainSourceMaps } from "./_sourcemap.ts";
import type { ImportKind, ResolvedId } from "./_host.ts";
import type { HookSourceMap, RawSourceMap, SourceMapStep } from "./_sourcemap.ts";

const NAME = "nitro:rollup-plugins";

/** Loader running the `load` and `transform` hooks (see `runtime/internal/rspack/loader.mjs`). */
export const LOADER_PATH: string = join(runtimeDir, "internal/rspack/loader.mjs");

// Shared with the loader, which is loaded by Rspack from a separate file
const hosts: Map<string, RollupPluginsHost> = ((globalThis as any).__nitro_rspack_hosts__ ??=
  new Map());

let nextId = 0;

const NOT_RESOLVED = Promise.resolve(undefined);

const BARE_IMPORT_RE = /^(?![./#\0]|[a-z]:[\\/]|[a-z][\w+.-]*:)/i;

/**
 * Rspack plugin running Nitro's build plugins (Rollup plugin interface):
 * - `resolveId` before Rspack resolves a request (virtual modules, externals, aliases).
 * - `load` and `transform` with a pre-loader (virtual modules are loaded from placeholder files).
 * - `buildStart`, `buildEnd` (once all modules are built) and `renderChunk` (on emitted chunks).
 */
export class RollupPluginsHost implements RspackPluginInstance {
  readonly id: string;
  readonly host: PluginHost;
  readonly virtual: VirtualPlaceholders;
  compilation?: Compilation;
  /** `resolveId` results by issuer and request, shared by `externals` and `beforeResolve`. */
  resolveCache = new Map<string, Promise<ResolvedId | undefined>>();
  /** `unresolvedExternal` results by resolve directory and request. */
  unresolvedCache = new Map<string, Promise<string | undefined>>();

  /** Externals that are not resolved (builtins and `external` of the preset). */
  readonly staticExternals: Set<string>;

  constructor(nitro: Nitro, plugins: Plugin[], opts: { externals?: string[] } = {}) {
    this.staticExternals = new Set(opts.externals);
    this.id = String(nextId++);
    hosts.set(this.id, this);
    nitro.hooks.hookOnce("close", () => {
      hosts.delete(this.id);
    });
    this.virtual = new VirtualPlaceholders(join(nitro.options.buildDir, "rspack/virtual"));
    this.host = new PluginHost(nitro, plugins, {
      resolve: (source, importer, kind) => this.resolveWithRspack(source, importer, kind),
      getModuleIds: () => this.moduleIds(),
    });
  }

  /** Loader rule options, for the pre-loader to find this instance. */
  get loaderOptions() {
    return { host: this.id };
  }

  apply(compiler: Compiler) {
    compiler.hooks.beforeCompile.tapPromise(NAME, () => this.host.buildStart());
    compiler.hooks.done.tapPromise(NAME, () => this.host.closeBundle());

    compiler.hooks.thisCompilation.tap(NAME, (compilation) => {
      this.compilation = compilation;
      this.resolveCache.clear();
      this.unresolvedCache.clear();
      compilation.hooks.finishModules.tapPromise(NAME, () => this.host.buildEnd());
      // After minification and before source maps are emitted
      compilation.hooks.processAssets.tapPromise(
        { name: NAME, stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING - 1 },
        () => this.renderChunks(compilation)
      );
    });

    compiler.hooks.normalModuleFactory.tap(NAME, (nmf) => {
      nmf.hooks.beforeResolve.tapPromise(NAME, async (data) => {
        if (data.request.includes("!")) {
          return;
        }
        const issuer = data.contextInfo.issuer;
        const resolved = await this.resolve(data.request, issuer);
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
  async externals(data: ExternalItemFunctionData): Promise<string | string[] | undefined> {
    const { request, dependencyType, contextInfo } = data;
    if (!request || request.includes("!")) {
      return;
    }
    const kind: ImportKind = dependencyType === "commonjs" ? "require-call" : "import-statement";
    let id: string | undefined;
    if (this.staticExternals.has(request)) {
      // Like the externals plugin (workerd only resolves builtins by their `node:` id)
      id = isBareBuiltin(request) ? `node:${request}` : request;
    } else {
      const resolved = await this.resolve(request, contextInfo?.issuer, kind);
      id = resolved
        ? resolved.external
          ? resolved.id
          : undefined
        : await this.unresolvedExternal(request, contextInfo?.issuer);
    }
    // `require()` from bundled CommonJS gets `module.exports` (not the namespace) with Node.js
    if (id && kind === "require-call") {
      if (this.host.nitro.options.node) {
        return `node-commonjs ${id.startsWith("file:") ? fileURLToPath(id) : id}`;
      }
      // Externals are ES modules: the default export of a builtin is its `module.exports`
      if (id.startsWith("node:")) {
        return [id, "default"];
      }
    }
    return id;
  }

  /** Like Rollup, bare imports that cannot be resolved are kept external (with a warning). */
  unresolvedExternal(request: string, issuer: string | undefined): Promise<string | undefined> {
    if (!BARE_IMPORT_RE.test(request)) {
      return NOT_RESOLVED;
    }
    const importer = issuer ? this.virtual.toId(issuer) : undefined;
    const key = `${this.resolveDir(importer)}\0${request}`;
    let result = this.unresolvedCache.get(key);
    if (!result) {
      result = this.resolveWithRspack(request, importer, "require-call").then(async (resolved) => {
        if (resolved || (await this.resolveWithRspack(request, importer))) {
          return;
        }
        this.host.nitro.logger.warn(
          `Could not resolve \`${request}\`${importer ? ` (imported by \`${importer}\`)` : ""}, treating it as external.`
        );
        return request;
      });
      this.unresolvedCache.set(key, result);
    }
    return result;
  }

  /** Runs the `resolveId` hooks once per issuer, request and import kind. */
  resolve(
    request: string,
    issuer: string | undefined,
    kind?: ImportKind
  ): Promise<ResolvedId | undefined> {
    if (!this.host.mayResolveId(request)) {
      return NOT_RESOLVED;
    }
    // `beforeResolve` has no import kind: its requests resolve as imports (like ESM externals)
    const key = `${issuer || ""}\0${request}\0${kind || "import-statement"}`;
    let resolved = this.resolveCache.get(key);
    if (!resolved) {
      const importer = issuer ? this.virtual.toId(issuer) : undefined;
      resolved = this.host.resolveId(request, importer, { isEntry: !issuer, kind });
      this.resolveCache.set(key, resolved);
    }
    return resolved;
  }

  /** Runs the `load` and `transform` hooks for a module (called by the pre-loader). */
  async runLoader(
    loader: LoaderContext,
    code: string,
    inputMap?: HookSourceMap
  ): Promise<{ code: string; map?: HookSourceMap | RawSourceMap }> {
    const id = this.virtual.toId(loader.resource);
    const ctxOpts = { addWatchFile: (file: string) => loader.addDependency(file) };
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

  async resolveWithRspack(source: string, importer: string | undefined, kind?: ImportKind) {
    const compiler = this.compilation?.compiler;
    if (!compiler) {
      return;
    }
    const resolver = compiler.resolverFactory.get("normal", {
      dependencyType: kind === "require-call" ? "commonjs" : "esm",
    });
    return new Promise<string | undefined>((resolve) => {
      resolver.resolve({}, this.resolveDir(importer), source, {}, (error, result) => {
        resolve(error || !result ? undefined : result);
      });
    });
  }

  /** Directory imports of a module resolve from (the root directory for virtual modules). */
  resolveDir(importer: string | undefined): string {
    const path = importer?.split("?")[0];
    return path && isAbsolute(path) ? dirname(path) : this.host.nitro.options.rootDir;
  }

  *moduleIds(): Iterable<string> {
    for (const module of this.compilation?.modules || []) {
      const resource = (module as { resource?: string }).resource;
      if (resource) {
        yield this.virtual.toId(resource);
      }
    }
  }

  async renderChunks(compilation: Compilation) {
    const sources = compilation.compiler.rspack.sources;
    // Plugins only need to generate source maps when they are emitted
    const outputOpts = {
      dir: compilation.outputOptions.path!,
      sourcemap: !!compilation.options.devtool,
    };
    for (const chunk of compilation.chunks) {
      for (const fileName of chunk.files) {
        if (!/\.m?js$/.test(fileName)) {
          continue;
        }
        const asset = compilation.getAsset(fileName);
        if (!asset) {
          continue;
        }
        const code = asset.source.source().toString();
        const chunkInfo = { fileName, name: chunk.name || "", isEntry: chunk.hasRuntime() };
        const maps: SourceMapStep[] = [];
        const rendered = await this.host.renderChunk(code, chunkInfo, outputOpts, maps);
        if (rendered === code) {
          continue;
        }
        const map = outputOpts.sourcemap ? asset.source.map() : undefined;
        const renderedMap = map && chainSourceMaps(sources, { name: fileName, map, steps: maps });
        compilation.updateAsset(
          fileName,
          renderedMap
            ? new sources.SourceMapSource(rendered, fileName, renderedMap)
            : new sources.RawSource(rendered)
        );
      }
    }
  }
}

function isBareBuiltin(id: string) {
  return !id.startsWith("node:") && builtinModules.includes(id);
}
