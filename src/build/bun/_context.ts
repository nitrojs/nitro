import type { EmittedFile, Plugin } from "rollup";
import { createHash } from "node:crypto";
import { basename, extname } from "pathe";
import type { OXC } from "../../utils/oxc.ts";
import type { PluginContainer } from "./_plugins.ts";
import { parseFilename } from "./_hooks.ts";

/**
 * The `this` of the hooks of `plugin` (a subset of Rollup's plugin context).
 *
 * `skip` holds the plugins skipped by the `this.resolve` call in progress (`skipSelf`).
 */
export function pluginContext(
  container: PluginContainer,
  opts: {
    plugin: Plugin;
    skip?: Set<Plugin>;
    /** Module of the `load` or `transform` hook (`this.parse` uses its language). */
    id?: string;
    oxc?: OXC;
    watchMode: boolean;
    onWarn: (message: string) => void;
  }
) {
  const { plugin, skip } = opts;
  return {
    meta: {
      // Rollup plugin API level (same as rolldown and Vite); `bunVersion` names the actual host
      rollupVersion: "4.23.0",
      bunVersion: (globalThis as any).Bun?.version as string | undefined,
      watchMode: opts.watchMode,
    },
    resolve: async (
      id: string,
      importer?: string,
      resolveOpts: { skipSelf?: boolean; kind?: string; isEntry?: boolean; custom?: unknown } = {}
    ) => {
      const nextSkip = resolveOpts.skipSelf === false ? skip : new Set([...(skip || []), plugin]);
      return (
        (await container.resolveId(id, importer, { ...resolveOpts, skip: nextSkip })) ||
        container.defaultResolve(id, importer, resolveOpts) ||
        null
      );
    },
    load: async ({ id }: { id: string }) => ({
      id,
      code: await container
        .load(id)
        .then((result) => (typeof result?.contents === "string" ? result.contents : null)),
    }),
    // Synchronous in Rollup: `oxc` is loaded by `buildStart`. Parsed with the language of the
    // module: `transform` hooks receive TypeScript and JSX untransformed
    parse: (code: string) => opts.oxc!.parseSync(parseFilename(opts.id), code).program,
    addWatchFile: (file: string) => {
      container.watchFiles.add(file);
    },
    getWatchFiles: () => [...container.watchFiles],
    getModuleIds: () => container.moduleIds.values(),
    getModuleInfo: () => null,
    emitFile: (file: EmittedFile) => {
      if (file.type !== "asset" || file.source === undefined) {
        throw new Error(`[${plugin.name}] Only assets with a \`source\` can be emitted with Bun.`);
      }
      const ext = extname(file.name || "");
      const fileName =
        file.fileName ||
        `_assets/${basename(file.name || "asset", ext)}-${hash(file.source)}${ext}`;
      const referenceId = hash(fileName);
      const emitted = { fileName, source: file.source };
      container.emittedFiles.set(referenceId, emitted);
      container.onEmitFile?.(emitted);
      return referenceId;
    },
    error: (error: string | Error) => {
      throw typeof error === "string" ? new Error(`[${plugin.name}] ${error}`) : error;
    },
    warn: (warning: string | { message: string }) => {
      opts.onWarn(`[${plugin.name}] ${typeof warning === "string" ? warning : warning.message}`);
    },
    info: () => {},
    debug: () => {},
  };
}

function hash(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 8);
}
