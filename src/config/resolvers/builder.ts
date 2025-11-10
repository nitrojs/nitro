import consola from "consola";
import type { NitroOptions } from "nitro/types";
import { createRequire } from "node:module";

const VALID_BUILDERS = ["rollup", "rolldown", "vite", "rolldown-vite"] as const;

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
    // Check if the builder package is installed
    const pkg = options.builder === "rolldown-vite" ? "vite" : options.builder;
    if (!isPkgInstalled(pkg, options.rootDir)) {
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

  // Auto-detect installed builder
  for (const pkg of ["rolldown", "rollup", "vite"] as const) {
    if (isPkgInstalled(pkg, options.rootDir)) {
      options.builder = pkg;
      return;
    }
  }

  // Prompt to choose and install a builder if none detected
  const pkgToInstall = await consola.prompt(
    `No nitro builder specified. Which builder would you like to install?`,
    {
      type: "select",
      cancel: "null",
      options: VALID_BUILDERS.map((b) => ({ label: b, value: b })),
    }
  );

  if (!pkgToInstall) {
    throw new Error(
      `No nitro builder specified. Please install one of the following packages: ${VALID_BUILDERS.join(
        ", "
      )} and set it as the builder in your nitro config or via the NITRO_BUILDER environment variable.`
    );
  }

  await installPkg(pkgToInstall, options.rootDir);
  options.builder = pkgToInstall;
}

const require = createRequire(process.cwd() + "/_index.js");

function isPkgInstalled(pkg: string, root: string) {
  try {
    require.resolve(pkg, { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

async function installPkg(pkg: string, root: string) {
  const { addDevDependency } = await import("nypm");
  const pkgSpec = pkg === "rolldown-vite" ? "vite@npm:rolldown-vite" : pkg;
  return addDevDependency(pkgSpec, { cwd: root });
}
