import type { Plugin } from "rollup";
import type { PluginHost } from "./_host.ts";
import type { ImportKind } from "./_resolve.ts";
import type { AssetSource, EmittedFile } from "./_files.ts";

export interface HookContextOptions {
  /** Called with the files a hook reads (`this.addWatchFile`). */
  addWatchFile?: (file: string) => void;
  /** Emits the assets of a module (`this.emitFile` in `load` and `transform`). */
  emitAsset?: (fileName: string, source: AssetSource) => void;
}

/** Plugin context (`this`) of the hooks of a plugin (a subset of Rollup's). */
export function createPluginContext(
  host: PluginHost,
  plugin: Plugin,
  opts: HookContextOptions & {
    /** Plugins skipped by the hook calling this one (`this.resolve` also skips the plugin itself). */
    skip?: Set<Plugin>;
    kind?: ImportKind;
  } = {}
) {
  const logger = host.nitro.logger;
  const format = (log: string | { message: string }) =>
    `[${plugin.name}] ${typeof log === "string" ? log : log.message}`;
  return {
    meta: { rollupVersion: "4.0.0", watchMode: host.nitro.options.dev },
    resolve: (
      source: string,
      importer: string | undefined,
      resolveOpts?: { skipSelf?: boolean; isEntry?: boolean; kind?: ImportKind }
    ) =>
      host
        .resolveId(source, importer, {
          // Like Rollup, plugins skipped by the calling hook stay skipped with `skipSelf: false`
          skip: resolveOpts?.skipSelf === false ? opts.skip : new Set(opts.skip).add(plugin),
          isEntry: resolveOpts?.isEntry,
          kind: resolveOpts?.kind || opts.kind,
          fallback: true,
        })
        .then((resolved) => resolved || null),
    load: async ({ id }: { id: string }) => {
      const loaded = await host.load(id, opts);
      return { id, code: loaded ? await host.transform(loaded.code, id, opts) : null };
    },
    addWatchFile: (file: string) => opts.addWatchFile?.(file),
    getModuleIds: () => host.opts.getModuleIds(),
    getModuleInfo: (id: string) => host.opts.getModuleInfo(id),
    emitFile: (file: EmittedFile) => {
      try {
        return host.files.emit(file, opts.emitAsset || host.opts.emitAsset);
      } catch (error) {
        throw new Error(format((error as Error).message));
      }
    },
    getFileName: (referenceId: string) => host.files.getFileName(referenceId),
    warn: (log: string | { message: string }) => logger.warn(format(log)),
    info: (log: string | { message: string }) => logger.info(format(log)),
    debug: (log: string | { message: string }) => logger.debug(format(log)),
    error: (error: string | Error): never => {
      throw typeof error === "string" ? new Error(format(error)) : error;
    },
  };
}
