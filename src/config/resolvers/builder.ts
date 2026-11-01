import { existsSync, readFileSync } from "node:fs";
import { consola } from "consola";
import type { NitroOptions } from "nitro/types";
import { resolve } from "pathe";
import { resolveRolldown } from "../../build/rolldown/_import.ts";
import { ensureDep, isDepInstalled, missingDepError } from "../../utils/dep.ts";

const VALID_BUILDERS = ["rolldown", "rollup", "vite"] as const;

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
    // Check if the builder package is installed (`rolldown` and `vite` are resolved when used)
    const pkg = options.builder;
    if (pkg === "rolldown" || pkg === "vite") {
      return;
    }
    const depOpts = {
      id: pkg,
      dir: options.rootDir,
      deps: options.deps,
    };
    if (!(await ensureDep(depOpts))) {
      throw missingDepError(depOpts);
    }
    return;
  }

  // Auto-detect: check for vite.config with nitro() plugin
  if (
    isDepInstalled("vite", { dir: options.rootDir, deps: options.deps }) &&
    hasNitroViteConfig(options)
  ) {
    if (!options.dev) {
      options.builder = "vite";
      return;
    }
    if (!_viteHintShown) {
      _viteHintShown = true;
      consola.warn(
        "Detected a `vite.config` with the `nitro()` plugin, but the Nitro dev server does not run Vite, so Vite plugins and features are not available. Use `vite dev` for the full Vite experience."
      );
    }
  }

  // Default to rolldown when installed in the project, and otherwise install it on build, unless
  // the dev server can run without a builder (no bundler config that `builder: false` would ignore)
  if (
    !options.dev ||
    resolveRolldown(options.rootDir, { paths: options.deps?.paths }) ||
    hasConfig(options.rollupConfig) ||
    hasConfig(options.rolldownConfig)
  ) {
    options.builder = "rolldown";
    return;
  }

  // Development without rolldown: run the server sources without a builder
  if (!_hintShown) {
    _hintShown = true;
    consola.info(
      "`rolldown` is not installed in your project. Running the dev server without a builder (experimental `builder: false`), so bundler plugins added by modules (`build:config` hook) do not apply. Install `rolldown` to bundle the server in development."
    );
  }
  options.builder = false;
}

let _hintShown = false;
let _viteHintShown = false;

function hasConfig(config: object | undefined): boolean {
  return !!config && Object.keys(config).length > 0;
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
