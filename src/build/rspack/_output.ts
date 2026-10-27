import type { Compilation } from "@rspack/core";
import type { PluginHost } from "./_host.ts";
import { applyBundle, createBundle, entryContent } from "./_bundle.ts";
import { chainSourceMaps } from "./_sourcemap.ts";
import type { SourceMapStep } from "./_sourcemap.ts";

/** Output options of the output hooks (plugins only need source maps when they are emitted). */
export function outputOptions(compilation: Compilation) {
  return { dir: compilation.outputOptions.path!, sourcemap: !!compilation.options.devtool };
}

/** Runs the `renderChunk` hooks on the emitted chunks (keeping their source maps). */
export async function renderChunks(host: PluginHost, compilation: Compilation) {
  const sources = compilation.compiler.rspack.sources;
  const outputOpts = outputOptions(compilation);
  for (const chunk of compilation.chunks) {
    for (const fileName of chunk.files) {
      if (!/\.m?js$/.test(fileName)) {
        continue;
      }
      const asset = compilation.getAsset(fileName);
      if (!asset) {
        continue;
      }
      const code = asset.source.source().toString();
      const chunkInfo = { fileName, name: chunk.name || "", isEntry: chunk.hasRuntime() };
      const maps: SourceMapStep[] = [];
      const rendered = await host.renderChunk(code, chunkInfo, outputOpts, maps);
      if (rendered === code) {
        continue;
      }
      const map = outputOpts.sourcemap ? asset.source.map() : undefined;
      const renderedMap = map && chainSourceMaps(sources, { name: fileName, map, steps: maps });
      compilation.updateAsset(
        fileName,
        renderedMap
          ? new sources.SourceMapSource(rendered, fileName, renderedMap)
          : new sources.RawSource(rendered)
      );
    }
  }
}

/** Runs the `generateBundle` hooks and applies their changes to the compilation assets. */
export async function generateBundle(
  host: PluginHost,
  compilation: Compilation,
  toId: (resource: string) => string
) {
  const bundle = createBundle(compilation, toId);
  const contents = new Map(Object.values(bundle).map((e) => [e.fileName, entryContent(e)]));
  await host.bundleHook("generateBundle", outputOptions(compilation), bundle);
  applyBundle(compilation, bundle, contents);
}

/** Runs the `writeBundle` hooks (once the compilation assets are written). */
export async function writeBundle(
  host: PluginHost,
  compilation: Compilation,
  toId: (resource: string) => string
) {
  if (host.hooks.writeBundle.length === 0) {
    return;
  }
  const bundle = createBundle(compilation, toId);
  await host.bundleHook("writeBundle", outputOptions(compilation), bundle);
}
