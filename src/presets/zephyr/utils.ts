import { normalize } from "pathe";
import { importDep } from "../../utils/dep.ts";

export const LOGGER_TAG = "zephyr-nitro-preset";

export type ZephyrProvider = "cloudflare" | (string & {});

const SUPPORTED_PROVIDERS = new Set(["cloudflare"]);

const DEFAULT_DEPLOY_TARGET = "web";
const DEFAULT_DEPLOY_SSR = true;
const SKIP_DEPLOY_PATTERNS = [
  /\.map$/i,
  /node_modules\//i,
  /\.git\//i,
  /\.DS_Store$/i,
  /^\.zephyr\//i,
];
const DEPLOY_ENTRYPOINT_CANDIDATES = [
  "server/index.js",
  "server/index.mjs",
  "server/server.js",
  "server/server.mjs",
  "server/_worker.js",
  "server/_worker.mjs",
  "index.mjs",
  "index.js",
] as const;

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
  return SUPPORTED_PROVIDERS.has(provider as string);
}

function parsePulledProvider(platform: unknown): ZephyrProvider {
  if (!isZephyrProvider(platform)) {
    throw new TypeError(
      `[${LOGGER_TAG}] Zephyr PLATFORM "${String(platform)}" is not supported yet by this Nitro preset. Supported today: cloudflare. See https://docs.zephyr-cloud.io`
    );
  }
  return platform;
}

/**
 * Strips leading `./` and `/`, trailing `/`, and normalizes backslashes to get a bare path segment.
 */
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
  publicDir?: string,
  baseURL = "/"
): string {
  const relativePath = normalize(file.relativePath);

  if (!publicDir) {
    return relativePath;
  }

  const fullPath = normalize(file.fullPath);
  const publicRoot = normalize(publicDir).replace(/\/+$/, "");
  if (fullPath.startsWith(`${publicRoot}/`)) {
    const staticRelative = fullPath.slice(publicRoot.length + 1);
    const basePath = normalizeBaseURL(baseURL);
    return basePath ? `client/${basePath}/${staticRelative}` : `client/${staticRelative}`;
  }
  return relativePath;
}

function resolveProvider(appPlatform: unknown): ZephyrProvider {
  return parsePulledProvider(appPlatform);
}

function shouldSkipDeployAsset(filePath: string): boolean {
  return SKIP_DEPLOY_PATTERNS.some((pattern) => pattern.test(filePath));
}

function resolveDeployEntrypoint(assets: Record<string, DirectoryAsset>): string | undefined {
  for (const candidate of DEPLOY_ENTRYPOINT_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(assets, candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export async function uploadNitroOutputToZephyr(opts: {
  rootDir: string;
  outputDir: string;
  publicDir?: string;
  baseURL?: string;
}): Promise<{ deploymentUrl: string | null; entrypoint?: string }> {
  const zephyrAgent = await importDep<ZephyrAgentModule>({
    id: "zephyr-agent",
    reason: "deploying to Zephyr",
    dir: opts.rootDir,
  });

  const files = await zephyrAgent.readDirRecursiveWithContents(opts.outputDir);

  const assets = files.reduce<Record<string, DirectoryAsset>>((memo, file) => {
    const relativePath = resolveAssetPath(file, opts.publicDir, opts.baseURL);
    if (shouldSkipDeployAsset(relativePath)) {
      return memo;
    }

    memo[relativePath] = {
      content: file.content,
    };
    return memo;
  }, {});

  if (Object.keys(assets).length === 0) {
    throw new TypeError(`[${LOGGER_TAG}] No deployable assets found in ${opts.outputDir}.`);
  }

  const entrypoint = resolveDeployEntrypoint(assets);
  if (DEFAULT_DEPLOY_SSR && !entrypoint) {
    throw new TypeError(
      `[${LOGGER_TAG}] Could not detect SSR entrypoint in ${opts.outputDir}. Expected one of: ${DEPLOY_ENTRYPOINT_CANDIDATES.join(", ")}.`
    );
  }

  const assetsMap = zephyrAgent.buildAssetsMap(
    assets,
    (asset: DirectoryAsset) => asset.content,
    () => "buffer"
  );

  const zephyrEngine = await zephyrAgent.ZephyrEngine.create({
    builder: "unknown",
    context: opts.rootDir,
  });

  const appConfig = await zephyrEngine.application_configuration;
  resolveProvider(appConfig?.PLATFORM);

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
