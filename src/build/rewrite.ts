import type { Nitro } from "nitro/types";
import { readFile } from "node:fs/promises";
import { glob } from "tinyglobby";
import { dirname, isAbsolute, relative } from "pathe";
import { writeFile } from "../utils/fs.ts";
import { presetsDir, runtimeDir } from "nitro/meta";

export async function rewriteBuilderlessImports(nitro: Nitro) {
  if (!nitro.options.builderless) {
    return;
  }

  const files = await glob("**/*.{mjs,js}", {
    cwd: nitro.options.output.serverDir,
    absolute: true,
  });

  await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf8");
      const rewritten = rewriteModuleImports(source, file, nitro);
      if (rewritten !== source) {
        await writeFile(file, rewritten);
      }
    })
  );
}

function rewriteModuleImports(source: string, fromFile: string, nitro: Nitro) {
  const rewrite = (specifier: string) => rewriteSpecifier(specifier, fromFile, nitro);

  return source
    .replace(/from\s+(['"])([^'"]+)\1/g, (_full, quote: string, specifier: string) => {
      return `from ${quote}${rewrite(specifier)}${quote}`;
    })
    .replace(/\bimport\s+(['"])([^'"]+)\1/g, (_full, quote: string, specifier: string) => {
      return `import ${quote}${rewrite(specifier)}${quote}`;
    })
    .replace(/import\(\s*(['"])([^'"]+)\1\s*\)/g, (_full, quote: string, specifier: string) => {
      return `import(${quote}${rewrite(specifier)}${quote})`;
    });
}

function rewriteSpecifier(specifier: string, fromFile: string, nitro: Nitro) {
  const [path, query] = splitSpecifier(specifier);
  if (!path || !isAbsolute(path) || !shouldRewrite(path, nitro)) {
    return specifier;
  }

  const relativePath = toPosixPath(relative(dirname(fromFile), path));
  const normalized = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  return normalized + query;
}

function shouldRewrite(path: string, nitro: Nitro) {
  if (isSubpath(path, runtimeDir) || isSubpath(path, presetsDir)) {
    return false;
  }
  if (isNodeModulesPath(path)) {
    return false;
  }

  const includeRoots = [...new Set([nitro.options.rootDir, ...nitro.options.scanDirs])];
  const excludeRoots = [
    nitro.options.buildDir,
    nitro.options.output.dir,
    nitro.options.output.serverDir,
    nitro.options.output.publicDir,
  ];

  if (!includeRoots.some((root) => isSubpath(path, root))) {
    return false;
  }
  return !excludeRoots.some((root) => isSubpath(path, root));
}

function splitSpecifier(specifier: string) {
  const queryIndex = specifier.indexOf("?");
  if (queryIndex < 0) {
    return [specifier, ""] as const;
  }
  return [specifier.slice(0, queryIndex), specifier.slice(queryIndex)] as const;
}

function isNodeModulesPath(path: string) {
  return /[/\\]node_modules[/\\]/.test(path);
}

function isSubpath(path: string, parent: string) {
  const rel = relative(parent, path);
  return !rel || (!rel.startsWith("..") && !isAbsolute(rel));
}

function toPosixPath(path: string) {
  return path.replace(/\\/g, "/");
}
