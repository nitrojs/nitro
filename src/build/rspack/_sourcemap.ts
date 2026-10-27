import type { ModuleFilenameTemplateContext, sources as RspackSources } from "@rspack/core";
import { existsSync } from "node:fs";
import { isAbsolute, relative } from "pathe";
import type { VirtualPlaceholders } from "./_virtual.ts";

export type RawSourceMap = {
  version: number;
  file: string;
  sources: string[];
  names: string[];
  mappings: string;
  sourcesContent?: string[];
};

/** Source map of a plugin hook result (`string`, `SourceMap` of `magic-string`, `null`...). */
export type HookSourceMap =
  | string
  | { mappings: string; sources?: (string | null)[]; names?: string[]; file?: string }
  | null;

/** A hook result with a source map (from its `input` code to its `output` code). */
export interface SourceMapStep {
  input: string;
  output: string;
  map: HookSourceMap;
}

/**
 * Chains the source maps of successive hook results onto an initial map (if any).
 *
 * Like Rollup, the `sources` of a hook map refer to its input code, and hooks without a map keep
 * the positions of their input code.
 */
export function chainSourceMaps(
  sources: typeof RspackSources,
  opts: { name: string; map?: HookSourceMap; steps: SourceMapStep[] }
): RawSourceMap | undefined {
  let map = opts.map ? parseMap(opts.map, opts.name) : undefined;
  for (const step of opts.steps) {
    if (!step.map) {
      continue;
    }
    const parsed = parseMap(step.map, opts.name);
    const count = Math.max(parsed.sources.length, 1);
    const stepMap: RawSourceMap = {
      ...parsed,
      sources: Array.from({ length: count }, () => opts.name),
      sourcesContent: Array.from({ length: count }, () => step.input),
    };
    const chained = map
      ? new sources.SourceMapSource(step.output, opts.name, stepMap, step.input, map, true).map()
      : undefined;
    map = (chained as RawSourceMap | null) || stepMap;
  }
  return map;
}

/**
 * `output.devtoolModuleFilenameTemplate`: source map sources of modules without a file on disk are
 * namespaced with `virtual:` (like `nitro:sourcemap` does with Rollup), so that consumers do not look
 * for missing files. These are Nitro virtual modules (their placeholder file is empty), Rspack
 * runtime modules and modules of `VirtualModulesPlugin` (e.g. WASM bindings of `unwasm`).
 */
export function moduleFilenameTemplate(opts: {
  rootDir: string;
  virtual: VirtualPlaceholders;
}): (info: ModuleFilenameTemplateContext) => string {
  const cache = new Map<string, string>();
  return ({ absoluteResourcePath: path }) => {
    let source = cache.get(path);
    if (source === undefined) {
      source = sourcePath(path, opts);
      cache.set(path, source);
    }
    return source;
  };
}

function parseMap(map: Exclude<HookSourceMap, null>, file: string): RawSourceMap {
  const parsed = typeof map === "string" ? JSON.parse(map) : map;
  return {
    version: 3,
    file,
    sources: parsed.sources || [],
    names: parsed.names || [],
    mappings: parsed.mappings,
    ...(parsed.sourcesContent && { sourcesContent: parsed.sourcesContent }),
  };
}

function sourcePath(path: string, opts: { rootDir: string; virtual: VirtualPlaceholders }) {
  if (opts.virtual.isVirtual(path)) {
    const id = opts.virtual.toId(path);
    return id.startsWith("virtual:") ? id : `virtual:${id}`;
  }
  if (!isAbsolute(path)) {
    return `virtual:${path.replace(/^webpack\//, "rspack/")}`;
  }
  return existsSync(path) ? path : `virtual:${relative(opts.rootDir, path)}`;
}
