import type { Nitro, RollupConfig } from "nitro/types";
import type { Plugin } from "rollup";
import { dirname, isAbsolute, normalize, relative, resolve } from "pathe";

export const LOGGER_TAG = "zephyr-nitro-preset";
const PROVIDER_PRESET_MAP = {
  cloudflare: "cloudflare-module",
} as const;
export type ZephyrProvider = keyof typeof PROVIDER_PRESET_MAP;
export const DEFAULT_BASE_PRESET = PROVIDER_PRESET_MAP.cloudflare;

const DEFAULT_METADATA_FILE = ".zephyr/nitro-build.json";
const DEFAULT_DEPLOY_TARGET = "web";
const DEFAULT_DEPLOY_SSR = true;
const SKIP_DEPLOY_PATTERNS = [/\.map$/i, /node_modules\//i, /\.git\//i, /\.DS_Store$/i];
let pulledProvider: ZephyrProvider | undefined;

interface ZephyrNitroBuildMetadata {
  generatedBy: "zephyr-nitro-preset";
  preset: string;
  outputDir: string;
}

interface DirectoryAsset {
  content: Buffer;
}

interface ZephyrEngineLike {
  application_configuration: Promise<{
    PLATFORM?: string;
  }>;
  env: {
    target: string;
    ssr?: boolean;
  };
  upload_assets: (props: {
    assetsMap: Record<string, unknown>;
    buildStats: unknown;
    snapshotType: "ssr" | "csr";
    entrypoint?: string;
    hooks?: {
      onDeployComplete?: (deploymentInfo: { url: string }) => void;
    };
  }) => Promise<void>;
}

interface ZephyrAgentModule {
  readDirRecursiveWithContents: (
    dirPath: string
  ) => Promise<Array<{ fullPath: string; relativePath: string; content: Buffer }>>;
  buildAssetsMap: <T>(
    assets: Record<string, T>,
    extractBuffer: (asset: T) => Buffer | string | undefined,
    getAssetType: (asset: T) => string
  ) => Record<string, unknown>;
  zeBuildDashData: (engine: any) => Promise<unknown>;
  ZephyrEngine: {
    create: (options: { builder: "unknown"; context: string }) => Promise<ZephyrEngineLike>;
  };
}

function isZephyrProvider(provider: unknown): provider is ZephyrProvider {
  return typeof provider === "string" && provider in PROVIDER_PRESET_MAP;
}

function parsePulledProvider(platform: unknown): ZephyrProvider {
  if (!isZephyrProvider(platform)) {
    throw new TypeError(
      `[${LOGGER_TAG}] Zephyr PLATFORM "${String(platform)}" is not supported yet by this Nitro preset. Supported today: cloudflare. See https://docs.zephyr-cloud.io`
    );
  }
  return platform;
}

function normalizeBaseURL(baseURL: string): string {
  let normalized = baseURL.trim().replace(/\\/g, "/");
  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  while (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function resolveAssetPath(
  file: { fullPath: string; relativePath: string },
  publicDir: string,
  baseURL: string
): string {
  const fullPath = toPosixPath(file.fullPath);
  const publicRoot = toPosixPath(publicDir).replace(/\/+$/, "");

  if (fullPath.startsWith(`${publicRoot}/`)) {
    const staticRelative = fullPath.slice(publicRoot.length + 1);
    const basePath = normalizeBaseURL(baseURL);
    return basePath ? `${basePath}/${staticRelative}` : staticRelative;
  }

  return toPosixPath(file.relativePath);
}

async function loadZephyrAgent(): Promise<ZephyrAgentModule> {
  try {
    return (await import("zephyr-agent")) as unknown as ZephyrAgentModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Cannot find package 'zephyr-agent'") ||
      message.includes("Cannot find module 'zephyr-agent'") ||
      message.includes("ERR_MODULE_NOT_FOUND")
    ) {
      throw new TypeError(
        `[${LOGGER_TAG}] Missing optional dependency \`zephyr-agent\`. Install with \`pnpm add -D zephyr-agent\`.`
      );
    }
    throw error;
  }
}

function resolveProvider(appPlatform: unknown): ZephyrProvider {
  const pulled = parsePulledProvider(appPlatform);
  if (!pulledProvider) {
    pulledProvider = pulled;
  }
  if (pulledProvider !== pulled) {
    throw new TypeError(
      `[${LOGGER_TAG}] Zephyr PLATFORM changed from "${pulledProvider}" to "${pulled}" within the same process.`
    );
  }
  return pulledProvider;
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
  return {
    name: "zephyr-nitro-metadata",
    generateBundle() {
      const asset = createZephyrNitroMetadataAsset(nitro, outputDir);
      this.emitFile(asset);
    },
  };
}

export async function uploadNitroOutputToZephyr(
  nitro: Nitro,
  outputDir: string
): Promise<{ deploymentUrl: string | null; entrypoint?: string }> {
  const zephyrAgent = await loadZephyrAgent();
  const publicDir = resolve(outputDir, nitro.options.output.publicDir);
  const files = await zephyrAgent.readDirRecursiveWithContents(outputDir);

  const assets = files.reduce<Record<string, DirectoryAsset>>((memo, file) => {
    const relativePath = resolveAssetPath(file, publicDir, nitro.options.baseURL);
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
  const provider = resolveProvider(appConfig?.PLATFORM);
  if (provider !== "cloudflare") {
    throw new TypeError(
      `[${LOGGER_TAG}] Zephyr PLATFORM "${provider}" is not supported yet by this Nitro preset. Supported today: cloudflare. See https://docs.zephyr-cloud.io`
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
