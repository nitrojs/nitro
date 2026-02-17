import type { Nitro, RollupConfig } from "nitro/types";
import type { Plugin } from "rollup";
import { dirname, isAbsolute, join, normalize, relative } from "pathe";

export const LOGGER_TAG = "zephyr-nitro-preset";
export const ZEPHYR_PLATFORM = "cloudflare";
export const PLATFORM_PRESET_MAP = {
  cloudflare: "cloudflare-module",
} as const;
export const DEFAULT_BASE_PRESET = PLATFORM_PRESET_MAP[ZEPHYR_PLATFORM];

const DEFAULT_METADATA_FILE = ".zephyr/nitro-build.json";
const DEFAULT_DEPLOY_TARGET = "web";
const DEFAULT_DEPLOY_SSR = true;
const SKIP_DEPLOY_PATTERNS = [/\.map$/i, /node_modules\//i, /\.git\//i, /\.DS_Store$/i];

interface ZephyrNitroBuildMetadata {
  generatedBy: "zephyr-nitro-preset";
  preset: string;
  outputDir: string;
}

interface DirectoryAsset {
  content: Buffer;
}

function normalizeMetadataFile(metadataFile: string): string {
  if (isAbsolute(metadataFile)) {
    throw new TypeError(
      `[${LOGGER_TAG}] \`metadataFile\` must be relative when using the bundler lifecycle.`
    );
  }

  const normalized = normalize(metadataFile).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized === ".") {
    throw new TypeError(`[${LOGGER_TAG}] \`metadataFile\` must point to a file path.`);
  }

  return normalized;
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function shouldSkipDeployAsset(filePath: string): boolean {
  return SKIP_DEPLOY_PATTERNS.some((pattern) => pattern.test(filePath));
}

function normalizeEntrypoint(entrypoint: string): string {
  let normalized = entrypoint.trim().replace(/\\/g, "/");
  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  while (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

function resolveDeployEntrypoint(assets: Record<string, DirectoryAsset>): string | undefined {
  const candidates = ["index.mjs", "index.js", "server/index.mjs", "server/index.js"];
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(assets, candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function toImportSpecifier(fromFile: string, toFile: string): string {
  const relativePath = relative(dirname(fromFile), toFile);
  if (!relativePath) {
    return "./";
  }
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

function createCloudflareEntrypointWrapper(entrypoint: string): {
  wrapperPath: string;
  source: string;
} {
  const wrapperPath = ".zephyr/entrypoint.mjs";
  const importPath = toImportSpecifier(wrapperPath, entrypoint);
  const source = `import nitroHandler from '${importPath}';

const base = nitroHandler?.default ?? nitroHandler;

export default {
  ...base,
  async fetch(request, env = {}, context) {
    if (typeof base?.fetch === 'function') {
      return base.fetch(request, env ?? {}, context);
    }

    if (typeof base === 'function') {
      return base(request, env ?? {}, context);
    }

    throw new TypeError('[${LOGGER_TAG}] Invalid Nitro Cloudflare entrypoint export.');
  },
};
`;

  return { wrapperPath, source };
}

function createZephyrNitroMetadata(nitro: Nitro, outputDir: string): ZephyrNitroBuildMetadata {
  return {
    generatedBy: "zephyr-nitro-preset",
    preset: nitro.options.preset,
    outputDir,
  };
}

function createZephyrNitroMetadataAsset(nitro: Nitro, outputDir: string) {
  const fileName = normalizeMetadataFile(DEFAULT_METADATA_FILE);
  return {
    type: "asset" as const,
    fileName,
    source: `${JSON.stringify(createZephyrNitroMetadata(nitro, outputDir), null, 2)}\n`,
  };
}

export function resolveBundlerOutputDir(nitro: Nitro, config: RollupConfig): string {
  const output = Array.isArray(config.output) ? config.output[0] : config.output;
  return output?.dir || nitro.options.output.serverDir || nitro.options.output.dir;
}

export function createZephyrMetadataPlugin(nitro: Nitro, outputDir: string): Plugin {
  const metadataPath = normalizeMetadataFile(DEFAULT_METADATA_FILE);
  const emittedMetadataPath = join(outputDir, metadataPath);

  return {
    name: "zephyr-nitro-metadata",
    generateBundle() {
      const asset = createZephyrNitroMetadataAsset(nitro, outputDir);
      this.emitFile(asset);
      nitro.logger.success(
        `[${LOGGER_TAG}] Emitted Nitro metadata asset at ${emittedMetadataPath}.`
      );
    },
  };
}

export async function uploadNitroOutputToZephyr(
  nitro: Nitro,
  outputDir: string
): Promise<{ deploymentUrl: string | null; entrypoint?: string }> {
  const zephyrAgent = await import("zephyr-agent");
  const files = await zephyrAgent.readDirRecursiveWithContents(outputDir);

  const assets = files.reduce<Record<string, DirectoryAsset>>((memo, file) => {
    const relativePath = toPosixPath(file.relativePath);
    if (shouldSkipDeployAsset(relativePath)) {
      return memo;
    }

    memo[relativePath] = {
      content: file.content,
    };
    return memo;
  }, {});

  if (Object.keys(assets).length === 0) {
    throw new TypeError(`[${LOGGER_TAG}] No deployable assets found in ${outputDir}.`);
  }

  let entrypoint = resolveDeployEntrypoint(assets);

  if (DEFAULT_DEPLOY_SSR && entrypoint) {
    const { wrapperPath, source } = createCloudflareEntrypointWrapper(
      normalizeEntrypoint(entrypoint)
    );
    assets[wrapperPath] = {
      content: Buffer.from(source, "utf8"),
    };
    entrypoint = wrapperPath;
  }

  const assetsMap = zephyrAgent.buildAssetsMap(
    assets,
    (asset: DirectoryAsset) => asset.content,
    () => "buffer"
  );

  const zephyrEngine = await zephyrAgent.ZephyrEngine.create({
    builder: "unknown",
    context: nitro.options.rootDir || process.cwd(),
  });

  const appConfig = await zephyrEngine.application_configuration;
  if (appConfig?.PLATFORM !== ZEPHYR_PLATFORM) {
    throw new TypeError(
      `[${LOGGER_TAG}] Unsupported Zephyr PLATFORM "${appConfig?.PLATFORM}". Expected "${ZEPHYR_PLATFORM}".`
    );
  }

  zephyrEngine.env.target = DEFAULT_DEPLOY_TARGET;
  zephyrEngine.env.ssr = DEFAULT_DEPLOY_SSR;

  const buildStats = await zephyrAgent.zeBuildDashData(zephyrEngine);
  let deploymentUrl: string | null = null;

  await zephyrEngine.upload_assets({
    assetsMap,
    buildStats,
    snapshotType: DEFAULT_DEPLOY_SSR ? "ssr" : "csr",
    entrypoint,
    hooks: {
      onDeployComplete(deploymentInfo) {
        deploymentUrl = deploymentInfo.url;
      },
    },
  });

  return { deploymentUrl, entrypoint };
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new TypeError(`[${LOGGER_TAG}] ${String(error)}`);
}
