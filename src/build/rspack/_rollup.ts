import type { Nitro } from "nitro/types";
import type { RspackPluginInstance } from "@rspack/core";
import { SourcemapPathTransformPlugin } from "./_sourcemap.ts";

type Rspack = typeof import("@rspack/core");

type RollupLikeConfig = { output?: Record<string, any> | Record<string, any>[] } & Record<
  string,
  any
>;

type ExternalOption =
  | string
  | RegExp
  | (string | RegExp)[]
  | ((source: string, importer: string | undefined, isResolved: boolean) => unknown);

const BANNER_KEYS = ["intro", "banner", "outro", "footer"] as const;

const OUTPUT_KEYS = new Set([
  ...BANNER_KEYS,
  "entryFileNames",
  "chunkFileNames",
  "inlineDynamicImports",
  "sourcemapExcludeSources",
  "sourcemapPathTransform",
  "format",
  // No effect on ESM output
  "exports",
  "generatedCode",
  "hoistTransitiveImports",
]);

const CONFIG_KEYS = new Set(["output", "plugins", "external", "platform"]);

/**
 * Options of `rollupConfig` and `rolldownConfig` (set by presets and users) that the `rspack`
 * builder applies. `rolldownConfig` takes precedence, like with the `rolldown` builder.
 */
export function rollupOptions(nitro: Nitro, rspack: Rspack) {
  const configs = [nitro.options.rolldownConfig, nitro.options.rollupConfig].filter(
    Boolean
  ) as RollupLikeConfig[];
  const outputs = configs.map((config) =>
    Array.isArray(config.output) ? config.output[0] || {} : config.output || {}
  );
  const output = (key: string) => outputs.map((o) => o[key]).find((v) => v !== undefined);

  const unsupported = new Set<string>();
  for (const [index, config] of configs.entries()) {
    for (const key of Object.keys(config)) {
      if (!CONFIG_KEYS.has(key) && config[key] !== undefined) {
        unsupported.add(key);
      }
    }
    for (const key of Object.keys(outputs[index]!)) {
      if (!OUTPUT_KEYS.has(key) && outputs[index]![key] !== undefined) {
        unsupported.add(`output.${key}`);
      }
    }
  }

  const fileName = (key: "entryFileNames" | "chunkFileNames") => {
    const value = output(key);
    const filename = typeof value === "string" ? toRspackFilename(value) : undefined;
    if (value !== undefined && !filename) {
      unsupported.add(`output.${key}`);
    }
    return filename;
  };
  const entryFileName = fileName("entryFileNames");
  const chunkFileName = fileName("chunkFileNames");

  const format = output("format");
  if (format !== undefined && !["es", "esm", "module"].includes(format)) {
    unsupported.add("output.format");
  }

  if (unsupported.size > 0) {
    nitro.logger.warn(
      `The \`rspack\` builder ignores these \`rollupConfig\` / \`rolldownConfig\` options: ${[...unsupported].map((key) => `\`${key}\``).join(", ")}. Use \`rspackConfig\` instead.`
    );
  }

  const plugins: RspackPluginInstance[] = [];
  for (const key of BANNER_KEYS) {
    const value = output(key);
    if (value && (typeof value === "string" || typeof value === "function")) {
      plugins.push(bannerPlugin(rspack, key, value));
    }
  }
  const pathTransform = output("sourcemapPathTransform");
  if (typeof pathTransform === "function") {
    plugins.push(new SourcemapPathTransformPlugin(pathTransform));
  }

  const externals = configs.map((config) => config.external).filter(Boolean) as ExternalOption[];

  return {
    entryFileName,
    chunkFileName,
    inlineDynamicImports: output("inlineDynamicImports") as boolean | undefined,
    sourcemapExcludeSources: output("sourcemapExcludeSources") as boolean | undefined,
    plugins,
    isExternal: externals.length > 0 ? matchExternal(externals) : undefined,
  };
}

/** Rollup file name pattern to an Rspack one (`undefined` if it has unsupported placeholders). */
function toRspackFilename(pattern: string): string | undefined {
  const filename = pattern
    .replace(/\[hash(?::(\d+))?\]/g, (_, length) => `[contenthash:${length || 8}]`)
    .replace(/\[format\]/g, "es");
  return /\[(?!name\]|contenthash:\d+\])[^\]]*\]/.test(filename) ? undefined : filename;
}

function bannerPlugin(rspack: Rspack, key: (typeof BANNER_KEYS)[number], value: unknown) {
  const banner =
    typeof value === "function"
      ? ({
          chunk,
          filename,
        }: {
          chunk: { name?: string; hasRuntime(): boolean };
          filename: string;
        }) => {
          const chunkInfo = {
            type: "chunk",
            fileName: filename,
            name: chunk.name || "",
            isEntry: chunk.hasRuntime(),
          };
          const result = value(chunkInfo);
          if (typeof result?.then === "function") {
            throw new TypeError(
              `Async \`output.${key}\` functions are not supported by the \`rspack\` builder.`
            );
          }
          return String(result ?? "");
        }
      : String(value);
  return new rspack.BannerPlugin({
    banner,
    raw: true,
    footer: key === "outro" || key === "footer",
    test: /\.m?js$/,
    // After minification (like Rollup), before source maps
    stage: rspack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
  });
}

function matchExternal(options: ExternalOption[]) {
  return async (source: string, importer: string | undefined) => {
    for (const option of options) {
      if (typeof option === "function") {
        if (await option(source, importer, false)) {
          return true;
        }
        continue;
      }
      const patterns = Array.isArray(option) ? option : [option];
      if (patterns.some((p) => (typeof p === "string" ? p === source : p.test(source)))) {
        return true;
      }
    }
    return false;
  };
}
