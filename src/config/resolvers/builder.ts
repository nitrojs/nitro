import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import consola from "consola";
import type { NitroOptions } from "nitro/types";
import { resolve } from "pathe";

const VALID_BUILDERS = ["rolldown", "rollup", "vite"] as const;

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
    if (pkg !== "rolldown" && !isPkgInstalled(pkg, options.rootDir)) {
      const shouldInstall = await consola.prompt(
        `Nitro builder package \`${pkg}\` is not installed. Would you like to install it?`,
        { type: "confirm", default: true, cancel: "null" }
      );
      if (!shouldInstall) {
        throw new Error(
          `Nitro builder package "${options.builder}" is not installed. Please install it in your project dependencies.`
        );
      }
      await installPkg(pkg, options.rootDir);
    }
    return;
  }

  // Auto-detect: check for vite.config with nitro() plugin
  if (isPkgInstalled("vite", options.rootDir) && hasNitroViteConfig(options)) {
    options.builder = "vite";
    return;
  }

  // Default to rolldown (direct dependency of nitro)
  options.builder = "rolldown";
}

const _require = createRequire(import.meta.url);

function isPkgInstalled(pkg: string, root: string) {
  try {
    _require.resolve(pkg, { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

async function installPkg(pkg: string, root: string) {
  const { addDevDependency } = await import("nypm");
  return addDevDependency(pkg, { cwd: root });
}

function hasNitroViteConfig(options: NitroOptions): boolean {
  const configExts = [".ts", ".mts", ".js", ".mjs"];
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
