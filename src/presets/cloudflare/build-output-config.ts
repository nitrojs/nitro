import type { Nitro } from "nitro/types";
import type {
  ConfigContext,
  ParsedInputSettingsConfig,
  ParsedInputWorkerConfig,
} from "@cloudflare/config";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { resolve } from "pathe";
import { importDep } from "../../utils/dep.ts";
import { generateWorkerName } from "./utils.ts";

type CloudflareConfigModule = typeof import("@cloudflare/config");

type WorkerConfig = Omit<ParsedInputWorkerConfig, "entrypoint">;

export interface BuildOutputConfig {
  cf: CloudflareConfigModule;
  settings: ParsedInputSettingsConfig;
  buildContext: ConfigContext;
  worker: WorkerConfig;
}

const CONFIG_FILENAME = "cloudflare.config.ts";
const WRANGLER_CONFIG_FILENAMES = ["wrangler.json", "wrangler.jsonc", "wrangler.toml"];

const _configs = new WeakMap<Nitro, BuildOutputConfig>();

/** Load and validate `cloudflare.config.ts` (evaluated for the build mode) before building. */
export async function loadBuildOutputConfig(nitro: Nitro): Promise<void> {
  const cf = await importCloudflareConfig(nitro);
  const buildContext = resolveBuildContext(nitro);

  let settings: ParsedInputSettingsConfig = {};
  let worker: WorkerConfig;
  const configPath = resolve(nitro.options.rootDir, CONFIG_FILENAME);
  if (existsSync(configPath)) {
    const { result } = await cf.loadAndParseConfig(configPath, buildContext);
    if (!result.success) {
      throw new Error(
        `[cloudflare] Invalid \`${CONFIG_FILENAME}\`:\n${formatIssues(result.error.issues)}`
      );
    }
    const { worker: parsedWorker, containers, ...parsedSettings } = result.data;
    if (!parsedWorker) {
      throw new Error(
        `[cloudflare] \`${CONFIG_FILENAME}\` must define a Worker using the \`worker\` property.`
      );
    }
    if (containers.length > 0) {
      nitro.logger.warn(
        `[cloudflare] Containers in \`${CONFIG_FILENAME}\` are not supported by the \`cloudflare\` preset yet and will be ignored.`
      );
    }
    const { entrypoint, ...workerConfig } = parsedWorker;
    if (entrypoint !== undefined) {
      nitro.logger.warn(
        `[cloudflare] Worker \`entrypoint\` in \`${CONFIG_FILENAME}\` is ignored: Nitro builds the Worker bundle.`
      );
    }
    settings = parsedSettings;
    worker = workerConfig;
  } else {
    worker = {
      name: await generateWorkerName(nitro),
      compatibilityDate:
        nitro.options.compatibilityDate.cloudflare || nitro.options.compatibilityDate.default,
    };
    nitro.logger.info(`Using auto generated worker name: \`${worker.name}\``);
  }

  warnIgnoredWranglerConfig(nitro);

  _configs.set(nitro, { cf, settings, buildContext, worker });
}

/**
 * The Build Output config with what Nitro adds to the Worker config (ASSETS binding, cron
 * triggers), once modules are done updating the build options.
 */
export function resolveBuildOutputConfig(nitro: Nitro): BuildOutputConfig {
  const config = _configs.get(nitro);
  if (!config) {
    throw new Error("[cloudflare] The Build Output config has not been loaded.");
  }
  return { ...config, worker: withNitroConfig(nitro, config.worker) };
}

export function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => `  - ${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/**
 * Import `@cloudflare/config`, preferring the version `cf` depends on, so that the config is
 * validated like the CLI that deploys it.
 */
async function importCloudflareConfig(nitro: Nitro): Promise<CloudflareConfigModule> {
  const paths = nitro.options.deps?.paths;
  if (!paths?.["@cloudflare/config"]) {
    const cfPkg = resolveModulePath("cf/package.json", { from: nitro.options.rootDir, try: true });
    const entry =
      cfPkg && resolveModulePath("@cloudflare/config", { from: pathToFileURL(cfPkg), try: true });
    if (entry) {
      return import(pathToFileURL(entry).href);
    }
  }
  return importDep({ id: "@cloudflare/config", dir: nitro.options.rootDir, paths });
}

function resolveBuildContext(nitro: Nitro): ConfigContext {
  return {
    isPreview: process.env.CLOUDFLARE_PREVIEW_BUILD === "true",
    mode:
      nitro.options.cloudflare?.mode ||
      process.env.CLOUDFLARE_BUILD_MODE ||
      nitro.options._vite?.mode ||
      undefined,
  };
}

function withNitroConfig(nitro: Nitro, config: WorkerConfig): WorkerConfig {
  // Static builds have no Worker script to bind assets to or trigger
  if (nitro.options.static) {
    return config;
  }

  const env = { ...config.env };
  if (!Object.values(env).some((binding) => binding.type === "assets")) {
    env.ASSETS = { type: "assets" };
  }

  const triggers = [...(config.triggers || [])];
  if (nitro.options.experimental.tasks) {
    for (const schedule of Object.keys(nitro.options.scheduledTasks || {})) {
      if (!triggers.some((t) => t.type === "scheduled" && t.schedule === schedule)) {
        triggers.push({ type: "scheduled", schedule });
      }
    }
  }

  return { ...config, env, triggers: nonEmpty(triggers) };
}

function nonEmpty<T>(array: T[]): T[] | undefined {
  return array.length > 0 ? array : undefined;
}

function warnIgnoredWranglerConfig(nitro: Nitro) {
  const sources = WRANGLER_CONFIG_FILENAMES.filter((file) =>
    existsSync(resolve(nitro.options.rootDir, file))
  ).map((file) => `\`${file}\``);
  if (Object.keys(nitro.options.cloudflare?.wrangler || {}).length > 0) {
    sources.push("`cloudflare.wrangler` (set by config or modules)");
  }
  if (sources.length > 0) {
    nitro.logger.warn(
      `[cloudflare] Wrangler config in ${sources.join(", ")} is ignored by the \`cloudflare\` preset. Configure the Worker in \`${CONFIG_FILENAME}\` instead.`
    );
  }
}
