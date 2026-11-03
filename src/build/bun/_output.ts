import type { BunBuildArtifact, BunMetafileOutput } from "./_types.ts";
import type { OutputAsset, OutputChunk, OutputOptions, RollupOutput } from "rollup";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "pathe";
import { VIRTUAL_NAMESPACE, type PluginContainer } from "./_plugins.ts";

type OutputBundle = Record<string, OutputChunk | OutputAsset>;

const PRAGMA_RE = /^\/\/ @bun\b.*\n/;

const FILE_URL_RE = /import\.meta\.ROLLUP_FILE_URL_(\w+)/g;

// Ids start with `\0` (only replaced at the start of strings, not in raw template literals)
const NUL_ESCAPE_RE = /(?<=["'])\\x00(?!\d)/g;

/**
 * Writes the in-memory Bun build output to `dir`, calling the output hooks of the plugins
 * (`renderChunk`, `generateBundle` and `writeBundle`) as Rollup does.
 */
export async function writeOutput(
  container: PluginContainer,
  opts: {
    outputs: BunBuildArtifact[];
    /** Metafile output of an artifact (by path). */
    meta: (path: string) => BunMetafileOutput | undefined;
    dir: string;
    format: "es" | "cjs" | "iife";
    sourcemap: boolean;
  }
): Promise<RollupOutput> {
  const outputOptions = {
    dir: opts.dir,
    format: opts.format,
    sourcemap: opts.sourcemap,
  } as OutputOptions;

  // Same as Rollup: file names such as `constructor` or `__proto__` are own properties
  const bundle: OutputBundle = Object.create(null);
  for (const artifact of opts.outputs) {
    const fileName = artifact.path.replace(/^\.\//, "");
    if (artifact.kind === "entry-point" || artifact.kind === "chunk") {
      bundle[fileName] = toChunk(container, fileName, {
        // Rollup plugins match `\0` ids in the output, which Bun writes as `\x00`
        code: (await artifact.text()).replace(NUL_ESCAPE_RE, "\\0"),
        isEntry: artifact.kind === "entry-point",
        meta: opts.meta(artifact.path),
      });
    } else {
      const source =
        artifact.kind === "sourcemap"
          ? relocateSources(container, await artifact.text(), dirname(join(opts.dir, fileName)))
          : await artifact.bytes();
      bundle[fileName] = toAsset(fileName, source);
    }
  }

  const chunks = Object.values(bundle).filter((output) => output.type === "chunk");
  const meta = { chunks: Object.fromEntries(chunks.map((chunk) => [chunk.fileName, chunk])) };
  // Source maps returned by `renderChunk` hooks are not used: they do not need to generate them
  const renderOptions = { ...outputOptions, sourcemap: false };
  for (const chunk of chunks) {
    // Bun only reads the pragma of bundled files (e.g. `// @bun`) on the first line
    const pragma = PRAGMA_RE.exec(chunk.code)?.[0] || "";
    chunk.code = await renderFileUrls(container, chunk.code.slice(pragma.length), {
      chunkId: chunk.fileName,
      format: opts.format,
    });
    chunk.code = await container.renderChunk(chunk.code, [chunk, renderOptions, meta]);
    chunk.code = pragma + chunk.code;
  }

  // Same as Rollup: assets emitted by `generateBundle` hooks are added to the bundle right away,
  // so later hooks can read or delete them
  const addAsset = ({ fileName, source }: { fileName: string; source: string | Uint8Array }) => {
    bundle[fileName] ??= toAsset(fileName, source);
  };
  for (const file of container.emittedFiles.values()) {
    addAsset(file);
  }
  container.onEmitFile = addAsset;
  try {
    await container.callBundleHook("generateBundle", [outputOptions, bundle, true]);
  } finally {
    container.onEmitFile = undefined;
  }

  await Promise.all(
    Object.values(bundle).map(async (output) => {
      const path = join(opts.dir, output.fileName);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, output.type === "chunk" ? output.code : output.source);
    })
  );

  await container.callBundleHook("writeBundle", [outputOptions, bundle]);

  return { output: Object.values(bundle) } as RollupOutput;
}

/** Renders the references to emitted assets (`import.meta.ROLLUP_FILE_URL_<id>`). */
async function renderFileUrls(
  container: PluginContainer,
  code: string,
  opts: { chunkId: string; format: string }
): Promise<string> {
  let rendered = "";
  let index = 0;
  for (const match of code.matchAll(FILE_URL_RE)) {
    const referenceId = match[1]!;
    const file = container.emittedFiles.get(referenceId);
    if (!file) {
      continue;
    }
    let relativePath = relative(dirname(opts.chunkId), file.fileName);
    relativePath = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
    const url =
      (await container.resolveFileUrl({
        chunkId: opts.chunkId,
        fileName: file.fileName,
        format: opts.format,
        moduleId: null,
        referenceId,
        relativePath,
      })) || `new URL(${JSON.stringify(relativePath)}, import.meta.url).href`;
    rendered += code.slice(index, match.index) + url;
    index = match.index + match[0].length;
  }
  return rendered + code.slice(index);
}

/**
 * Bun writes the sources of source maps relative to the working directory, and virtual modules
 * in its namespace: they are namespaced as `virtual:<id>` instead (same as `nitro:sourcemap`).
 */
function relocateSources(container: PluginContainer, code: string, dir: string): string {
  const map = JSON.parse(code) as { sources?: string[] };
  map.sources = map.sources?.map((source) => {
    const id = container.moduleId(source);
    if (isAbsolute(id) && !id.includes("\0")) {
      return relative(dir, id);
    }
    if (!source.startsWith(`${VIRTUAL_NAMESPACE}:`)) {
      return source;
    }
    const virtualId = id.replace(/^\0/, "");
    return virtualId.startsWith("virtual:") ? virtualId : `virtual:${virtualId}`;
  });
  return JSON.stringify(map);
}

function toChunk(
  container: PluginContainer,
  fileName: string,
  opts: { code: string; isEntry: boolean; meta?: BunMetafileOutput }
): OutputChunk {
  const { meta } = opts;
  const imports = (kind: string) =>
    (meta?.imports || [])
      .filter((entry) => (entry.kind === "dynamic-import") === (kind === "dynamic-import"))
      .map((entry) => (entry.external ? entry.path : entry.path.replace(/^\.\//, "")));
  const facadeModuleId = meta?.entryPoint ? container.moduleId(meta.entryPoint) : null;
  return {
    type: "chunk",
    fileName,
    preliminaryFileName: fileName,
    name: basename(fileName).replace(/\.[^.]+$/, ""),
    code: opts.code,
    map: null,
    sourcemapFileName: null,
    isEntry: opts.isEntry,
    isDynamicEntry: !opts.isEntry && !!facadeModuleId,
    isImplicitEntry: false,
    facadeModuleId,
    moduleIds: Object.keys(meta?.inputs || {}).map((input) => container.moduleId(input)),
    modules: {},
    exports: meta?.exports || [],
    imports: imports("import-statement"),
    dynamicImports: imports("dynamic-import"),
    importedBindings: {},
    implicitlyLoadedBefore: [],
    referencedFiles: [],
  };
}

function toAsset(fileName: string, source: string | Uint8Array): OutputAsset {
  return {
    type: "asset",
    fileName,
    name: undefined,
    names: [],
    originalFileName: null,
    originalFileNames: [],
    source,
    needsCodeReference: false,
  };
}
