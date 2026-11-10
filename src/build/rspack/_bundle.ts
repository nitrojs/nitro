import type { Asset, Chunk, Compilation } from "@rspack/core";
import type { AssetSource } from "./_files.ts";
import { chunkModuleIds } from "./_modules.ts";

/** Rollup `OutputChunk` (with the fields Rspack chunks provide) or `OutputAsset`. */
export type BundleEntry =
  | { type: "chunk"; fileName: string; code: string; [key: string]: unknown }
  | { type: "asset"; fileName: string; source: AssetSource; [key: string]: unknown };

export type Bundle = Record<string, BundleEntry>;

/** Entries whose code or source was assigned by a hook. */
const changedEntries = new WeakSet<BundleEntry>();

/**
 * Output bundle of the `generateBundle` and `writeBundle` hooks, from the compilation assets.
 * Chunks have their file, name, code and module ids, but no import or export information.
 * Contents and module ids are read from the compilation when a hook accesses them.
 */
export function createBundle(compilation: Compilation, toId: (resource: string) => string): Bundle {
  const chunks = new Map<string, Chunk>();
  for (const chunk of compilation.chunks) {
    for (const file of chunk.files) {
      chunks.set(file, chunk);
    }
  }
  const bundle: Bundle = {};
  for (const asset of compilation.getAssets()) {
    const fileName = asset.name;
    const chunk = /\.m?js$/.test(fileName) ? chunks.get(fileName) : undefined;
    if (!chunk) {
      const entry = {
        type: "asset",
        fileName,
        name: undefined,
        names: [],
        originalFileName: null,
        originalFileNames: [],
        needsCodeReference: false,
      } as unknown as BundleEntry;
      bundle[fileName] = lazy(entry, "source", () => assetSource(asset), true);
      continue;
    }
    const entry = {
      type: "chunk",
      fileName,
      preliminaryFileName: fileName,
      sourcemapFileName: (asset.info.related?.sourceMap as string | undefined) ?? null,
      name: chunk.name || "",
      map: null,
      isEntry: chunk.hasRuntime(),
      isDynamicEntry: !chunk.canBeInitial(),
      isImplicitEntry: false,
      facadeModuleId: null,
      modules: {},
      exports: [],
      imports: [],
      dynamicImports: [],
      implicitlyLoadedBefore: [],
      importedBindings: {},
      referencedFiles: [],
    } as unknown as BundleEntry;
    lazy(entry, "code", () => assetSource(asset).toString(), true);
    bundle[fileName] = lazy(entry, "moduleIds", () => chunkModuleIds(compilation, chunk, toId));
  }
  return bundle;
}

/** Applies the changes of the `generateBundle` hooks (`original` is the bundle before them). */
export function applyBundle(compilation: Compilation, bundle: Bundle, original: Bundle) {
  for (const fileName of Object.keys(original)) {
    if (!bundle[fileName]) {
      compilation.deleteAsset(fileName);
    }
  }
  for (const [fileName, entry] of Object.entries(bundle)) {
    if (entry !== original[fileName] || changedEntries.has(entry)) {
      writeAsset(compilation, fileName, entry.type === "chunk" ? entry.code : entry.source);
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

function assetSource(asset: Asset): AssetSource {
  return asset.source.source();
}

/** Defines a property computed on first access (assignments mark the entry as changed). */
function lazy(entry: BundleEntry, key: string, get: () => unknown, content?: boolean) {
  let value: unknown;
  let loaded = false;
  Object.defineProperty(entry, key, {
    enumerable: true,
    configurable: true,
    get: () => {
      if (!loaded) {
        value = get();
        loaded = true;
      }
      return value;
    },
    set: (newValue) => {
      value = newValue;
      loaded = true;
      if (content) {
        changedEntries.add(entry);
      }
    },
  });
  return entry;
}
