import type { Chunk, Compilation } from "@rspack/core";
import type { AssetSource } from "./_files.ts";
import { moduleId } from "./_modules.ts";

/** Rollup `OutputChunk` (with the fields Rspack chunks provide) or `OutputAsset`. */
export type BundleEntry =
  | { type: "chunk"; fileName: string; code: string; [key: string]: unknown }
  | { type: "asset"; fileName: string; source: AssetSource; [key: string]: unknown };

export type Bundle = Record<string, BundleEntry>;

/**
 * Output bundle of the `generateBundle` and `writeBundle` hooks, from the compilation assets.
 * Chunks have their file, name, code and module ids, but no import or export information.
 */
export function createBundle(compilation: Compilation, toId: (resource: string) => string): Bundle {
  const chunks = new Map<string, Chunk>();
  for (const chunk of compilation.chunks) {
    for (const file of chunk.files) {
      chunks.set(file, chunk);
    }
  }
  const bundle: Bundle = {};
  for (const { name: fileName, source, info } of compilation.getAssets()) {
    const chunk = /\.m?js$/.test(fileName) ? chunks.get(fileName) : undefined;
    if (!chunk) {
      bundle[fileName] = {
        type: "asset",
        fileName,
        name: undefined,
        names: [],
        originalFileName: null,
        originalFileNames: [],
        source: source.source(),
        needsCodeReference: false,
      };
      continue;
    }
    const moduleIds: string[] = [];
    for (const module of compilation.chunkGraph.getChunkModules(chunk)) {
      const id = moduleId(module, toId);
      if (id) {
        moduleIds.push(id);
      }
    }
    bundle[fileName] = {
      type: "chunk",
      fileName,
      preliminaryFileName: fileName,
      sourcemapFileName: (info.related?.sourceMap as string | undefined) ?? null,
      name: chunk.name || "",
      code: source.source().toString(),
      map: null,
      isEntry: chunk.hasRuntime(),
      isDynamicEntry: !chunk.canBeInitial(),
      isImplicitEntry: false,
      facadeModuleId: null,
      moduleIds,
      modules: {},
      exports: [],
      imports: [],
      dynamicImports: [],
      implicitlyLoadedBefore: [],
      importedBindings: {},
      referencedFiles: [],
    };
  }
  return bundle;
}

/** Code of a chunk or source of an asset. */
export function entryContent(entry: BundleEntry): AssetSource {
  return entry.type === "chunk" ? entry.code : entry.source;
}

/** Applies the changes of the `generateBundle` hooks (to the entry `contents` before them). */
export function applyBundle(
  compilation: Compilation,
  bundle: Bundle,
  contents: Map<string, AssetSource>
) {
  for (const fileName of contents.keys()) {
    if (!bundle[fileName]) {
      compilation.deleteAsset(fileName);
    }
  }
  for (const [fileName, entry] of Object.entries(bundle)) {
    const content = entryContent(entry);
    if (content !== contents.get(fileName)) {
      writeAsset(compilation, fileName, content);
    }
  }
}

/** Emits (or replaces) an asset of the compilation. */
export function writeAsset(compilation: Compilation, fileName: string, source: AssetSource) {
  const { RawSource } = compilation.compiler.rspack.sources;
  const rawSource = new RawSource(
    typeof source === "string" || Buffer.isBuffer(source) ? source : Buffer.from(source)
  );
  if (compilation.getAsset(fileName)) {
    compilation.updateAsset(fileName, rawSource);
  } else {
    compilation.emitAsset(fileName, rawSource);
  }
}
