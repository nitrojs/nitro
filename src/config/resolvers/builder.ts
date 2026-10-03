import { existsSync, readFileSync } from "node:fs";
import { consola } from "consola";
import type { NitroOptions } from "nitro/types";
import { resolve } from "pathe";
import { ROLLDOWN_VERSION, resolveRolldown } from "../../build/rolldown/_import.ts";
import { ensureDep, isDepInstalled } from "../../utils/dep.ts";

const VALID_BUILDERS = ["rolldown", "rollup", "vite"] as const;

const BUILDER_VERSIONS: Record<string, string | undefined> = {
  rolldown: ROLLDOWN_VERSION,
  rollup: "^4",
  vite: "^8",
};

export async function resolveBuilder(options: NitroOptions) {
  // NITRO_BUILDER environment variable
  options.builder ??= process.env.NITRO_BUILDER as any;

  // `NITRO_BUILDER=false` (also when forwarded from a config)
  if ((options.builder as unknown) === "false") {
    options.builder = false;
  }

  // Run without a builder
  if (options.builder === false) {
    return;
  }

  // Builder is explicitly set
  if (options.builder) {
    // Validate builder name
    if (!VALID_BUILDERS.includes(options.builder)) {
      throw new Error(
        `Invalid nitro builder "${options.builder}". Valid builders are: ${VALID_BUILDERS.join(", ")}.`
      );
    }
    // Check if the builder package is installed (`vite` can be provided)
    const pkg = options.builder;
    if (
      (pkg === "vite" && options.vite?.path) ||
      (pkg === "rolldown" && resolveRolldown(options.rootDir))
    ) {
      return;
    }
    const resolved = await ensureDep({
      id: pkg,
      dir: options.rootDir,
      reason: `the \`${pkg}\` builder`,
      version: BUILDER_VERSIONS[pkg],
    });
    if (!resolved) {
      throw new Error(
        `Nitro builder package "${pkg}" is not installed. Please install it in your project dependencies.`
      );
    }
    return;
  }

  // Auto-detect: check for vite.config with nitro() plugin
  if (isDepInstalled("vite", { dir: options.rootDir }) && hasNitroViteConfig(options)) {
    options.builder = "vite";
    return;
  }

  // Default to rolldown when installed in the project, and for production builds (installed on demand)
  if (!options.dev || resolveRolldown(options.rootDir)) {
    options.builder = "rolldown";
    return;
  }

  // Development without rolldown: run the server sources without a builder
  consola.info(
    "`rolldown` is not installed in your project. Running the dev server without a builder (experimental `builder: false`). Install `rolldown` to bundle the server in development."
  );
  options.builder = false;
}

function hasNitroViteConfig(options: NitroOptions): boolean {
  const configExts = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
  for (const ext of configExts) {
    const configPath = resolve(options.rootDir, `vite.config${ext}`);
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf8");
        if (content.includes("nitro(")) {
          return true;
        }
      } catch {}
    }
  }
  return false;
}
