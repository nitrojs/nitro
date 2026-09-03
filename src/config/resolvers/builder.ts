import { existsSync, readFileSync } from "node:fs";
import type { NitroOptions } from "nitro/types";
import { resolve } from "pathe";
import { ensureDep, isDepInstalled } from "../../utils/dep.ts";

const VALID_BUILDERS = ["rolldown", "rollup", "vite"] as const;

const BUILDER_VERSIONS: Record<string, string | undefined> = { rollup: "^4", vite: "^8" };

export async function resolveBuilder(options: NitroOptions) {
  // NITRO_BUILDER environment variable
  options.builder ??= process.env.NITRO_BUILDER as any;

  // Builder is explicitly set
  if (options.builder) {
    // Validate builder name
    if (!VALID_BUILDERS.includes(options.builder)) {
      throw new Error(
        `Invalid nitro builder "${options.builder}". Valid builders are: ${VALID_BUILDERS.join(", ")}.`
      );
    }
    // Check if the builder package is installed (rolldown is a direct dep)
    const pkg = options.builder;
    if (pkg !== "rolldown") {
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
    }
    return;
  }

  // Auto-detect: check for vite.config with nitro() plugin
  if (isDepInstalled("vite", options.rootDir) && hasNitroViteConfig(options)) {
    options.builder = "vite";
    return;
  }

  // Default to rolldown (direct dependency of nitro)
  options.builder = "rolldown";
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
