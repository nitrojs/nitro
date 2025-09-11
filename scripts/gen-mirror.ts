import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "mlly";
import { join } from "pathe";
import { readPackageJSON } from "pkg-types";
import { distSubpaths } from "../build.config";
import type {PackageJson} from "pkg-types";

const copyPkgFields = [
  "description",
  "keywords",
  "repository",
  "license",
  "type",
  "exports",
  "main",
  "types",
  "bin",
  "files",
];

const copyFiles = ["README.md", "LICENSE"];

async function main() {
  // Dirs
  const mainDir = fileURLToPath(new URL("..", import.meta.url));
  const mirrorDir = fileURLToPath(new URL("../.mirror", import.meta.url));
  await rm(mirrorDir, { recursive: true }).catch(() => {});
  await mkdir(mirrorDir, { recursive: true });

  // Read main package
  const mainPkg = await readPackageJSON(mainDir);

  // Check for nightly
  const isNightly = mainPkg.name!.includes("nightly");

  // Mirror nitro<>nitropack
  const mirrrorPkgName = mainPkg.name!.includes("pack")
    ? mainPkg.name!.replace("pack", "")
    : mainPkg.name!.replace("nitro", "nitropack");

  // Canonical name for main pkg (without -nightly suffix)
  const canonicalName = mainPkg.name!.replace("-nightly", "");

  // Copy package.json fields
  const mirrorPkg: PackageJson = {
    name: mirrrorPkgName,
    version: `${mainPkg.version}-mirror`,
    dependencies: {},
  };

  // Add dependency
  if (isNightly) {
    mirrorPkg.dependencies![canonicalName] =
      `npm:${mainPkg.name}@${mainPkg.version}`;
  } else {
    mirrorPkg.dependencies![canonicalName] = `${mainPkg.version}`;
  }

  for (const field of copyPkgFields) {
    if (mainPkg[field]) {
      mirrorPkg[field] = mainPkg[field];
    }
  }
  await writeFile(
    join(mirrorDir, "package.json"),
    JSON.stringify(mirrorPkg, null, 2)
  );

  // Generate subpath re-exports
  for (const subpath of distSubpaths) {
    await mkdir(join(mirrorDir, "dist", subpath), { recursive: true });
    await writeFile(
      join(mirrorDir, "dist", subpath, "index.mjs"),
      `export * from "${canonicalName}/${subpath}";`
    );
    await writeFile(
      join(mirrorDir, "dist", subpath, "index.d.ts"),
      `export * from "${canonicalName}/${subpath}";`
    );
    await writeFile(
      join(mirrorDir, "dist", subpath, "index.d.mts"),
      `export * from "${canonicalName}/${subpath}";`
    );
    await writeFile(
      join(mirrorDir, `${subpath}.d.ts`),
      `export * from "./dist/${subpath}";`
    );
  }

  // Runtime Meta
  await writeFile(
    join(mirrorDir, "runtime-meta.mjs"),
    `export * from "${canonicalName}/runtime/meta";`
  );
  await writeFile(
    join(mirrorDir, "runtime-meta.d.ts"),
    `export * from "${canonicalName}/runtime/meta";`
  );

  // Other files
  for (const file of copyFiles) {
    await cp(join(mainDir, file), join(mirrorDir, file));
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main();
