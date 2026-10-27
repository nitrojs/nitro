import type {
  Chunk,
  Compilation,
  Compiler,
  Filename,
  Module,
  OptimizationSplitChunksOptions,
  PathData,
  RspackPluginInstance,
} from "@rspack/core";
import type { Nitro } from "nitro/types";
import { isAbsolute, normalize } from "pathe";
import { getChunkName, libChunkName, NODE_MODULES_RE } from "../chunks.ts";
import { moduleId } from "./_modules.ts";

const FALLBACK = "_chunks/[id].mjs";

const WASM_BINDING_RE = /\.wasm(?:\.module)?\.unwasm\.mjs$/;

const WASM_HELPERS_RE = /[/\\]\.unwasm-helpers\.mjs$/;

/**
 * Names chunk files like the other builders (see `getChunkName`), from the modules of each chunk.
 * Names are computed once per compilation (in chunk id order), with a counter on collisions.
 */
export class ChunkNames implements RspackPluginInstance {
  readonly nitro: Nitro;
  readonly toId: (resource: string) => string;
  /** File names that chunks cannot take (entry files). */
  readonly reserved: string[];
  compilation?: Compilation;
  /** File names of the current compilation by chunk id. */
  names?: Map<string | number, string>;

  constructor(nitro: Nitro, opts: { toId: (resource: string) => string; reserved?: string[] }) {
    this.nitro = nitro;
    this.toId = opts.toId;
    this.reserved = opts.reserved || [];
  }

  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap("nitro:chunk-names", (compilation) => {
      this.compilation = compilation;
      this.names = undefined;
    });
  }

  /** `output.chunkFilename` (and `filename` of split chunks). */
  filename = (pathData: PathData): string => {
    const id = pathData.chunk?.id;
    const compilation = this.compilation;
    if (id == null || !compilation) {
      return FALLBACK;
    }
    this.names ??= this.chunkFileNames(compilation);
    return this.names.get(id) ?? FALLBACK;
  };

  /** `optimization.splitChunks` putting each package of `node_modules` in a `_libs/` chunk. */
  splitChunks(filename: Filename = this.filename): OptimizationSplitChunksOptions {
    return {
      cacheGroups: {
        default: false,
        defaultVendors: false,
        libs: {
          chunks: "all",
          test: (module) => NODE_MODULES_RE.test(module.nameForCondition() || ""),
          name: (module) => libChunkName(module.nameForCondition() || ""),
          filename,
          enforce: true,
          reuseExistingChunk: true,
        },
      },
    };
  }

  chunkFileNames(compilation: Compilation): Map<string | number, string> {
    const used = new Set(this.reserved.map((name) => name.toLowerCase()));
    const names = new Map<string | number, string>();
    const chunks = [...compilation.chunks]
      .filter((chunk) => chunk.id != null && !isEntryChunk(compilation, chunk))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const chunk of chunks) {
      const moduleIds = chunkModuleIds(compilation, chunk, this.toId);
      const name = chunk.name || nameFromId(moduleIds.at(-1)) || String(chunk.id);
      const fileName = getChunkName({ name, moduleIds }, this.nitro).replaceAll("[name]", name);
      names.set(chunk.id!, uniqueName(fileName, used));
    }
    return names;
  }
}

function isEntryChunk(compilation: Compilation, chunk: Chunk) {
  return compilation.chunkGraph.getNumberOfEntryModules(chunk) > 0;
}

/** Module ids of a chunk, in the order they finish loading (the root module last, like Rollup). */
function chunkModuleIds(
  compilation: Compilation,
  chunk: Chunk,
  toId: (resource: string) => string
): string[] {
  const group = [...chunk.groupsIterable][0];
  const modules = compilation.chunkGraph
    .getChunkModules(chunk)
    .flatMap((module) => (module as { modules?: Module[] }).modules || [module]);
  const order = (module: Module) => group?.getModulePostOrderIndex(module) ?? -1;
  return modules
    .map((module) => ({ id: moduleId(module, toId), index: order(module) }))
    .filter((entry): entry is { id: string; index: number } => !!entry.id)
    .sort((a, b) => a.index - b.index)
    .map((entry) => chunkModuleId(entry.id));
}

/**
 * Module id as the other builders see it: paths with `/` separators (like the handlers of Nitro),
 * and `unwasm` bindings by their `.wasm` file.
 */
function chunkModuleId(id: string): string {
  if (WASM_HELPERS_RE.test(id)) {
    return "\0unwasm:helpers";
  }
  return (isAbsolute(id) ? normalize(id) : id).replace(WASM_BINDING_RE, ".wasm");
}

/** Chunk name of a module id (like Rollup, its file name without query and script extension). */
function nameFromId(id: string | undefined): string | undefined {
  const base = id
    ?.split("?")[0]!
    .split(/[/\\]/)
    .pop()
    ?.replace(/\.(?:[cm]?[jt]sx?|wasm)$/, "");
  return base?.replace(/[^\w.-]+/g, "_") || undefined;
}

function uniqueName(fileName: string, used: Set<string>): string {
  let name = fileName;
  for (let i = 2; used.has(name.toLowerCase()); i++) {
    name = fileName.replace(/(\.mjs)?$/, `${i}$1`);
  }
  used.add(name.toLowerCase());
  return name;
}
