import type { Chunk, Compilation, Module } from "@rspack/core";

/** Minimal Rollup `ModuleInfo` (`this.getModuleInfo`). */
export interface ModuleInfo {
  id: string;
  isEntry: boolean;
  isExternal: boolean;
  importers: string[];
  importedIds: string[];
  dynamicImporters: string[];
  dynamicallyImportedIds: string[];
  meta: Record<string, unknown>;
}

/** Plugin id of a module (`undefined` for modules without resource, such as externals). */
export function moduleId(
  module: Module | null | undefined,
  toId: (resource: string) => string
): string | undefined {
  const resource = (module as { resource?: string } | null | undefined)?.resource;
  return resource ? toId(resource) : undefined;
}

/** Modules of a chunk, with the modules of concatenated modules (production builds). */
export function chunkModules(compilation: Compilation, chunk: Chunk): Module[] {
  return compilation.chunkGraph.getChunkModules(chunk).flatMap(innerModules);
}

/** Module ids of a chunk, in the order they finish loading (the root module last, like Rollup). */
export function chunkModuleIds(
  compilation: Compilation,
  chunk: Chunk,
  toId: (resource: string) => string
): string[] {
  const group = [...chunk.groupsIterable][0];
  const order = (module: Module) => group?.getModulePostOrderIndex(module) ?? -1;
  return chunkModules(compilation, chunk)
    .map((module) => ({ id: moduleId(module, toId), index: order(module) }))
    .filter((entry): entry is { id: string; index: number } => !!entry.id)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.id);
}

/** Ids of the modules of a compilation. */
export function compilationModuleIds(
  compilation: Compilation,
  toId: (resource: string) => string
): Iterable<string> {
  return indexModules(compilation, toId).keys();
}

/** Info of a module of the compilation (from its module graph connections). */
export function getModuleInfo(
  compilation: Compilation,
  id: string,
  toId: (resource: string) => string
): ModuleInfo | null {
  const module = findModule(compilation, id, toId);
  if (!module) {
    return null;
  }
  const { moduleGraph } = compilation;
  const info: ModuleInfo = {
    id,
    isEntry: false,
    isExternal: false,
    importers: [],
    importedIds: [],
    dynamicImporters: [],
    dynamicallyImportedIds: [],
    meta: {},
  };
  for (const connection of moduleGraph.getIncomingConnections(module)) {
    // The origin of connections from concatenated modules is the concatenated module
    const importer =
      moduleId(connection.originModule, toId) ??
      moduleId(moduleGraph.getParentModule(connection.dependency), toId);
    if (!connection.originModule) {
      info.isEntry ||= connection.dependency.type === "entry";
    } else if (importer) {
      addUnique(isDynamic(connection) ? info.dynamicImporters : info.importers, importer);
    }
  }
  for (const connection of moduleGraph.getOutgoingConnections(module)) {
    const imported = moduleId(connection.module, toId);
    if (imported) {
      addUnique(isDynamic(connection) ? info.dynamicallyImportedIds : info.importedIds, imported);
    }
  }
  return info;
}

const moduleIndexes = new WeakMap<Compilation, { size: number; modules: Map<string, Module> }>();

/** Modules of a compilation by id (indexed again when modules were added or concatenated). */
function indexModules(compilation: Compilation, toId: (resource: string) => string) {
  let index = moduleIndexes.get(compilation);
  if (index?.size === compilation.modules.size) {
    return index.modules;
  }
  index = { size: compilation.modules.size, modules: new Map() };
  for (const module of [...compilation.modules].flatMap(innerModules)) {
    const id = moduleId(module, toId);
    if (id && !index.modules.has(id)) {
      index.modules.set(id, module);
    }
  }
  moduleIndexes.set(compilation, index);
  return index.modules;
}

function findModule(
  compilation: Compilation,
  id: string,
  toId: (resource: string) => string
): Module | undefined {
  return moduleIndexes.get(compilation)?.modules.get(id) ?? indexModules(compilation, toId).get(id);
}

function innerModules(module: Module): Module[] {
  return (module as { modules?: Module[] }).modules || [module];
}

function isDynamic(connection: { dependency: { type: string } }): boolean {
  return connection.dependency.type === "import()";
}

function addUnique(list: string[], value: string) {
  if (!list.includes(value)) {
    list.push(value);
  }
}
