// Ported from @hiogawa/vite-plugin-fullstack (MIT License, Copyright (c) 2024 Hiroshi Ogawa)

import type { ResolvedConfig, Rollup, ViteBuilder } from "vite";
import type { AssetsImportState } from "./_assets.ts";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "pathe";
import { SERVICE_MANIFEST_FILE } from "./services.ts";
import {
  ASSETS_MANIFEST_FILE,
  RuntimeURL,
  serializeAssetsManifest,
  type ManifestEntry,
} from "../_assets-import.ts";

/**
 * Write the manifest of the `?assets` imports collected while building the server environments,
 * once the environments they target are built.
 *
 * The assets emitted by the importer environments (e.g. server css) are copied to the client output.
 * Collected state is reset afterwards.
 */
export async function writeAssetsManifest(
  builder: ViteBuilder,
  state: AssetsImportState
): Promise<void> {
  const config = builder.config;
  const manifest: Record<string, Record<string, ManifestEntry>> = {};
  const importers = new Set<string>();
  for (const [environmentName, imports] of Object.entries(state.imports)) {
    const bundle = state.bundles[environmentName];
    if (!bundle) {
      throw new Error(
        `Cannot write the \`?assets\` manifest: the \`${environmentName}\` environment was not built.`
      );
    }
    const assetDeps = collectAssetDeps(bundle);
    const cssCodeSplit = builder.environments[environmentName]!.config.build.cssCodeSplit;
    for (const meta of Object.values(imports)) {
      for (const importer of meta.importerEnvironments) {
        importers.add(importer);
      }
      const found = assetDeps.get(meta.id);
      if (!found) {
        throw new Error(
          `Cannot find \`${meta.key}\` (\`?assets\` import of the \`${[...meta.importerEnvironments].join("`, `")}\` environment) in the \`${environmentName}\` build. It must be bundled by the \`${environmentName}\` environment.`
        );
      }
      const entry: ManifestEntry = { js: [], css: [] };
      if (environmentName === "client") {
        entry.entry = assetsURL(found.chunk.fileName, config);
        entry.js = found.js.map((fileName) => ({ href: assetsURL(fileName, config) }));
      }
      entry.css = found.css.map((fileName) => ({ href: assetsURL(fileName, config) }));
      if (!cssCodeSplit) {
        const singleCss = Object.values(bundle).find(
          (v) => v.type === "asset" && v.originalFileNames.includes("style.css")
        );
        if (singleCss) {
          entry.css.push({ href: assetsURL(singleCss.fileName, config) });
        }
      }
      (manifest[environmentName] ??= {})[meta.key] = entry;
    }
  }

  const clientOutDir = _outDir(builder.environments.client!);
  for (const name of importers) {
    const outDir = _outDir(builder.environments[name]!);
    await writeFile(join(outDir, ASSETS_MANIFEST_FILE), serializeAssetsManifest(manifest), "utf8");
    for (const asset of Object.values(state.bundles[name] || {})) {
      if (asset.type === "asset" && !_isBuildMetadata(asset.fileName)) {
        const dest = join(clientOutDir, asset.fileName);
        await mkdir(dirname(dest), { recursive: true });
        await copyFile(join(outDir, asset.fileName), dest);
      }
    }
  }

  // Collected again by the next build of the same plugin instance
  state.imports = {};
  state.bundles = {};
}

/** The chunk of each module, with the js chunks and css files it statically imports. */
function collectAssetDeps(bundle: Rollup.OutputBundle) {
  const deps = new Map<string, { chunk: Rollup.OutputChunk; js: string[]; css: string[] }>();
  for (const chunk of Object.values(bundle)) {
    if (chunk.type !== "chunk") {
      continue;
    }
    const js = new Set<string>();
    const css = new Set<string>();
    const recurse = (fileName: string) => {
      const item = bundle[fileName];
      if (js.has(fileName) || item?.type !== "chunk") {
        return;
      }
      js.add(fileName);
      for (const file of item.viteMetadata?.importedCss || []) {
        css.add(file);
      }
      item.imports.forEach(recurse);
    };
    recurse(chunk.fileName);
    for (const id of chunk.moduleIds) {
      deps.set(id, { chunk, js: [...js], css: [...css] });
    }
  }
  return deps;
}

function assetsURL(fileName: string, config: ResolvedConfig): string | RuntimeURL {
  const renderBuiltUrl = config.experimental?.renderBuiltUrl;
  if (typeof renderBuiltUrl === "function") {
    const result = renderBuiltUrl(fileName, {
      type: "asset",
      hostType: "js",
      ssr: true,
      hostId: "",
    });
    if (typeof result === "object") {
      if (result.runtime) {
        return new RuntimeURL(result.runtime);
      }
      if (result.relative) {
        throw new Error(
          "`?assets` imports do not support `relative` results of `experimental.renderBuiltUrl`."
        );
      }
    } else if (result) {
      return result;
    }
  }
  return config.base + fileName;
}

/** Server build files that must not be publicly served. */
function _isBuildMetadata(fileName: string): boolean {
  return fileName === SERVICE_MANIFEST_FILE || fileName.startsWith(".vite/");
}

function _outDir(environment: ViteBuilder["environments"][string]): string {
  return resolve(environment.config.root, environment.config.build.outDir);
}
