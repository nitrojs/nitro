import type { Nitro } from "nitro/types";
import type { ModuleType } from "@cloudflare/config";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { extname, join, relative, resolve } from "pathe";
import { glob } from "tinyglobby";
import { writeFile } from "../_utils/fs.ts";
import {
  formatIssues,
  loadBuildOutputConfig,
  resolveBuildOutputConfig,
} from "./build-output-config.ts";

// https://developers.cloudflare.com/cf/projects/
const BUILD_OUTPUT_DIR = ".cloudflare/output/v0";
const MAIN_MODULE = "index.mjs";

const moduleTypes: Record<string, ModuleType> = {
  ".mjs": "esm",
  ".js": "esm",
  ".map": "sourcemap",
  ".wasm": "wasm",
};

/** Validate the build options and load the Worker config (before building). */
export async function setupBuildOutput(nitro: Nitro) {
  nitro.logger.warn(
    "[cloudflare] The `cloudflare` preset is experimental: the `cf` CLI and its Build Output are in beta and may change."
  );
  if (!nitro.options.output.dir.replace(/\/$/, "").endsWith(BUILD_OUTPUT_DIR)) {
    nitro.logger.warn(
      `[cloudflare] \`cf\` only deploys the Build Output from \`<root>/${BUILD_OUTPUT_DIR}\`, but \`output.dir\` is \`${nitro.options.output.dir}\`.`
    );
  }
  if (nitro.options.compressPublicAssets) {
    nitro.logger.warn(
      "[cloudflare] `compressPublicAssets` is disabled: Cloudflare compresses static assets itself."
    );
    nitro.options.compressPublicAssets = false;
    // `nitro build` compresses public assets before building (and listing them in the bundle)
    await removeCompressedAssets(nitro);
  }
  await loadBuildOutputConfig(nitro);
}

/**
 * Write the configs of the Build Output (`config.json` and `workers/default/worker.config.json`)
 * next to the Worker bundle and assets Nitro built in place.
 */
export async function writeBuildOutput(nitro: Nitro) {
  const { cf, settings, buildContext, worker } = resolveBuildOutputConfig(nitro);

  const rootConfig = cf.OutputRootConfigSchema.safeParse({ ...settings, buildContext });
  if (!rootConfig.success) {
    throw new Error(`[cloudflare] Invalid root config:\n${formatIssues(rootConfig.error.issues)}`);
  }

  const outputWorker = cf.OutputWorkerSchema.safeParse({
    ...worker,
    // Assets-only Workers have no bundle
    manifest: nitro.options.static ? undefined : await scanManifest(nitro.options.output.serverDir),
  });
  if (!outputWorker.success) {
    throw new Error(
      `[cloudflare] Invalid Worker config:\n${formatIssues(outputWorker.error.issues)}`
    );
  }

  await writeFile(
    resolve(nitro.options.output.dir, "config.json"),
    JSON.stringify(rootConfig.data)
  );
  await writeFile(
    resolve(nitro.options.output.dir, "workers/default/worker.config.json"),
    JSON.stringify(outputWorker.data),
    true
  );
}

/**
 * Remove the `.gz`, `.br` and `.zst` siblings written by `compressPublicAssets`, keeping the
 * compressed files of the `publicAssets` directories.
 */
async function removeCompressedAssets(nitro: Nitro) {
  const { publicDir } = nitro.options.output;
  if (!existsSync(publicDir)) {
    return;
  }
  const files = await glob("**/*.{gz,br,zst}", { cwd: publicDir, dot: true });
  await Promise.all(
    files
      .filter(
        (file) =>
          existsSync(resolve(publicDir, file.replace(/\.(gz|br|zst)$/, ""))) &&
          !isPublicAssetSource(nitro, resolve(publicDir, file))
      )
      .map((file) => rm(resolve(publicDir, file)))
  );
}

/** Whether a file of the public dir is copied from one of the `publicAssets` directories. */
function isPublicAssetSource(nitro: Nitro, path: string): boolean {
  return nitro.options.publicAssets.some((asset) => {
    const file = relative(join(nitro.options.output.publicDir, asset.baseURL || ""), path);
    return !file.startsWith("..") && existsSync(resolve(asset.dir, file));
  });
}

/** List every module of the bundle (a complete manifest: nothing is inferred on deploy). */
async function scanManifest(bundleDir: string) {
  const files = await glob("**/*", { cwd: bundleDir, dot: true });
  const modules: Record<string, { type: ModuleType }> = {};
  for (const file of files.sort()) {
    const type = moduleTypes[extname(file)];
    if (type) {
      modules[file] = { type };
    }
  }
  if (!modules[MAIN_MODULE]) {
    throw new Error(
      `[cloudflare] Worker entry \`${MAIN_MODULE}\` not found in \`${join(bundleDir, MAIN_MODULE)}\`.`
    );
  }
  return { type: "complete" as const, mainModule: MAIN_MODULE, modules };
}
