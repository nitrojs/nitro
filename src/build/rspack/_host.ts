import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { isHook, isUnsupportedHook, matchFilter, sortedHooks, SUPPORTED_HOOKS } from "./_hooks.ts";
import type { Hook, HookName } from "./_hooks.ts";

/** Import kind (Rolldown's `kind` resolve option): `require()` resolves with `require` conditions. */
export type ImportKind = "import-statement" | "require-call";

export interface ResolvedId {
  id: string;
  external: boolean;
}

export interface HookContextOptions {
  /** Called with the files a hook reads (`this.addWatchFile`). */
  addWatchFile?: (file: string) => void;
}

export interface PluginHostOptions {
  /** Resolve with the bundler (when no plugin resolves the import). */
  resolve: (
    source: string,
    importer: string | undefined,
    kind?: ImportKind
  ) => Promise<string | undefined>;
  /** Ids of the modules in the current build (`this.getModuleIds()`). */
  getModuleIds: () => Iterable<string>;
}

/**
 * Runs the `resolveId`, `load`, `transform`, `renderChunk`, `buildStart` and `buildEnd` hooks of
 * Rollup plugins, with the subset of the plugin context Nitro's own plugins use.
 */
export class PluginHost {
  readonly plugins: Plugin[];
  readonly nitro: Nitro;
  readonly opts: PluginHostOptions;
  readonly hooks: Record<HookName, Hook[]>;

  constructor(nitro: Nitro, plugins: Plugin[], opts: PluginHostOptions) {
    this.nitro = nitro;
    this.plugins = plugins;
    this.opts = opts;
    this.hooks = Object.fromEntries(
      [...SUPPORTED_HOOKS].map((name) => [name, sortedHooks(plugins, name)])
    ) as Record<HookName, Hook[]>;
    for (const plugin of plugins) {
      const unsupported = Object.entries(plugin)
        .filter(([key, value]) => isHook(value) && isUnsupportedHook(key))
        .map(([key]) => key);
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

  async closeBundle() {
    for (const hook of this.hooks.closeBundle) {
      await hook.handler.call(this.context(hook.plugin));
    }
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

  async load(id: string, ctxOpts?: HookContextOptions): Promise<string | undefined> {
    for (const hook of this.hooks.load) {
      if (!matchFilter(hook.filter?.id, id)) {
        continue;
      }
      const result = await hook.handler.call(this.context(hook.plugin, ctxOpts), id);
      const code = typeof result === "string" ? result : result?.code;
      if (code != null) {
        return code;
      }
    }
  }

  async transform(code: string, id: string, ctxOpts?: HookContextOptions): Promise<string> {
    for (const hook of this.hooks.transform) {
      if (!matchFilter(hook.filter?.id, id) || !matchFilter(hook.filter?.code, code, true)) {
        continue;
      }
      const result = await hook.handler.call(this.context(hook.plugin, ctxOpts), code, id);
      const transformed = typeof result === "string" ? result : result?.code;
      if (transformed != null) {
        code = transformed;
      }
    }
    return code;
  }

  async renderChunk(
    code: string,
    chunk: { fileName: string; name: string; isEntry: boolean },
    outputOpts: { dir: string; sourcemap: boolean }
  ): Promise<string> {
    for (const hook of this.hooks.renderChunk) {
      const result = await hook.handler.call(
        this.context(hook.plugin),
        code,
        chunk,
        { format: "es", ...outputOpts },
        {}
      );
      const rendered = typeof result === "string" ? result : result?.code;
      if (rendered != null) {
        code = rendered;
      }
    }
    return code;
  }

  context(
    plugin: Plugin,
    opts: HookContextOptions & { skip?: Set<Plugin>; kind?: ImportKind } = {}
  ) {
    const logger = this.nitro.logger;
    const format = (log: string | { message: string }) =>
      `[${plugin.name}] ${typeof log === "string" ? log : log.message}`;
    return {
      meta: { rollupVersion: "4.0.0", watchMode: this.nitro.options.dev },
      resolve: (
        source: string,
        importer: string | undefined,
        resolveOpts?: { skipSelf?: boolean; isEntry?: boolean; kind?: ImportKind }
      ) =>
        this.resolveId(source, importer, {
          skip: resolveOpts?.skipSelf === false ? undefined : opts.skip || new Set([plugin]),
          isEntry: resolveOpts?.isEntry,
          kind: resolveOpts?.kind || opts.kind,
          fallback: true,
        }).then((resolved) => resolved || null),
      load: async ({ id }: { id: string }) => {
        const code = await this.load(id, opts);
        return { id, code: code == null ? null : await this.transform(code, id, opts) };
      },
      addWatchFile: (file: string) => opts.addWatchFile?.(file),
      getModuleIds: () => this.opts.getModuleIds(),
      getModuleInfo: () => null,
      emitFile: () => {
        throw new Error(format("`this.emitFile` is not supported by the `rspack` builder."));
      },
      warn: (log: string | { message: string }) => logger.warn(format(log)),
      info: (log: string | { message: string }) => logger.info(format(log)),
      debug: (log: string | { message: string }) => logger.debug(format(log)),
      error: (error: string | Error): never => {
        throw typeof error === "string" ? new Error(format(error)) : error;
      },
    };
  }
}
