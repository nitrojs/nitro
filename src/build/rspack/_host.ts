import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { matchFilter, sortedHooks, SUPPORTED_HOOKS, unsupportedHooks } from "./_hooks.ts";
import type { Hook, HookName } from "./_hooks.ts";
import { createPluginContext } from "./_context.ts";
import type { HookContextOptions } from "./_context.ts";
import { EmittedFiles } from "./_files.ts";
import type { Bundle } from "./_bundle.ts";
import type { AssetSource } from "./_files.ts";
import type { ModuleInfo } from "./_modules.ts";
import { hookResultCode } from "./_sourcemap.ts";
import type { HookSourceMap, SourceMapStep } from "./_sourcemap.ts";
import type { ImportKind, ResolvedId } from "./_resolve.ts";

export interface PluginHostOptions {
  /** Resolve with the bundler (when no plugin resolves the import). */
  resolve: (
    source: string,
    importer: string | undefined,
    kind?: ImportKind
  ) => Promise<string | undefined>;
  /** Ids of the modules in the current build (`this.getModuleIds()`). */
  getModuleIds: () => Iterable<string>;
  /** Info of a module in the current build (`this.getModuleInfo()`). */
  getModuleInfo: (id: string) => ModuleInfo | null;
  /** Emits an asset of the current build (`this.emitFile`). */
  emitAsset: (fileName: string, source: AssetSource) => void;
}

/**
 * Runs the hooks of Rollup plugins (see `SUPPORTED_HOOKS`), with a subset of the plugin context.
 */
export class PluginHost {
  readonly plugins: Plugin[];
  readonly nitro: Nitro;
  readonly opts: PluginHostOptions;
  readonly hooks: Record<HookName, Hook[]>;
  readonly files = new EmittedFiles();

  constructor(nitro: Nitro, plugins: Plugin[], opts: PluginHostOptions) {
    this.nitro = nitro;
    this.plugins = plugins;
    this.opts = opts;
    this.hooks = Object.fromEntries(
      [...SUPPORTED_HOOKS].map((name) => [name, sortedHooks(plugins, name)])
    ) as Record<HookName, Hook[]>;
    for (const plugin of plugins) {
      const unsupported = unsupportedHooks(plugin);
      if (unsupported.length > 0) {
        nitro.logger.warn(
          `Build plugin \`${plugin.name}\` uses hooks the \`rspack\` builder does not support (ignored): ${unsupported.map((h) => `\`${h}\``).join(", ")}.`
        );
      }
    }
  }

  async buildStart() {
    for (const hook of this.hooks.buildStart) {
      await hook.handler.call(this.context(hook.plugin), {});
    }
  }

  async buildEnd(error?: Error) {
    for (const hook of this.hooks.buildEnd) {
      await hook.handler.call(this.context(hook.plugin), error);
    }
  }

  /** Runs the `generateBundle` or `writeBundle` hooks (in place on the `bundle`). */
  async bundleHook(
    name: "generateBundle" | "writeBundle",
    outputOpts: { dir: string; sourcemap: boolean },
    bundle: Bundle
  ) {
    const args = name === "generateBundle" ? [bundle, true] : [bundle];
    for (const hook of this.hooks[name]) {
      await hook.handler.call(this.context(hook.plugin), { format: "es", ...outputOpts }, ...args);
    }
  }

  async closeBundle() {
    for (const hook of this.hooks.closeBundle) {
      await hook.handler.call(this.context(hook.plugin));
    }
  }

  /** Whether the `resolveId` filter of a hook matches the source (otherwise it does not need to run). */
  mayResolveId(source: string): boolean {
    return this.hooks.resolveId.some((hook) => matchFilter(hook.filter?.id, source));
  }

  async resolveId(
    source: string,
    importer: string | undefined,
    opts: { skip?: Set<Plugin>; fallback?: boolean; isEntry?: boolean; kind?: ImportKind } = {}
  ): Promise<ResolvedId | undefined> {
    for (const hook of this.hooks.resolveId) {
      if (opts.skip?.has(hook.plugin) || !matchFilter(hook.filter?.id, source)) {
        continue;
      }
      const skip = new Set(opts.skip).add(hook.plugin);
      const result = await hook.handler.call(
        this.context(hook.plugin, { skip, kind: opts.kind }),
        source,
        importer,
        {
          isEntry: !!opts.isEntry,
          kind: opts.kind || "import-statement",
          attributes: {},
          custom: {},
        }
      );
      if (result === false) {
        return { id: source, external: true };
      }
      if (typeof result === "string") {
        return { id: result, external: false };
      }
      if (result?.id) {
        return { id: result.id, external: !!result.external };
      }
    }
    if (opts.fallback) {
      const resolved = await this.opts.resolve(source, importer, opts.kind);
      return resolved ? { id: resolved, external: false } : undefined;
    }
  }

  async load(
    id: string,
    ctxOpts?: HookContextOptions
  ): Promise<{ code: string; map?: HookSourceMap } | undefined> {
    for (const hook of this.hooks.load) {
      if (!matchFilter(hook.filter?.id, id)) {
        continue;
      }
      const result = await hook.handler.call(this.context(hook.plugin, ctxOpts), id);
      if (typeof result === "string") {
        return { code: result };
      }
      if (result?.code != null) {
        return { code: result.code, map: result.map };
      }
    }
  }

  /** Runs the `transform` hooks (pushing their source maps to `maps`, when given). */
  async transform(
    code: string,
    id: string,
    ctxOpts?: HookContextOptions,
    maps?: SourceMapStep[]
  ): Promise<string> {
    for (const hook of this.hooks.transform) {
      if (!matchFilter(hook.filter?.id, id) || !matchFilter(hook.filter?.code, code, true)) {
        continue;
      }
      const result = await hook.handler.call(this.context(hook.plugin, ctxOpts), code, id);
      code = hookResultCode(code, result, maps);
    }
    return code;
  }

  /** Runs the `renderChunk` hooks (pushing their source maps to `maps`, when given). */
  async renderChunk(
    code: string,
    chunk: { fileName: string; name: string; isEntry: boolean },
    outputOpts: { dir: string; sourcemap: boolean },
    maps?: SourceMapStep[]
  ): Promise<string> {
    for (const hook of this.hooks.renderChunk) {
      const result = await hook.handler.call(
        this.context(hook.plugin),
        code,
        chunk,
        { format: "es", ...outputOpts },
        {}
      );
      code = hookResultCode(code, result, maps);
    }
    return code;
  }

  context(
    plugin: Plugin,
    opts: HookContextOptions & { skip?: Set<Plugin>; kind?: ImportKind } = {}
  ) {
    return createPluginContext(this, plugin, opts);
  }
}
