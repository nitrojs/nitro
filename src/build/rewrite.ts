import type { Nitro } from "nitro/types";
import { readFile } from "node:fs/promises";
import { glob } from "tinyglobby";
import { dirname, relative } from "pathe";
import { writeFile } from "../utils/fs.ts";
import { isBuilderlessUserCodePath, splitSpecifier } from "./utils/builderless-path.ts";

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
  if (!path || !isBuilderlessUserCodePath(path, nitro)) {
    return specifier;
  }

  const relativePath = toPosixPath(relative(dirname(fromFile), path));
  const normalized = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  return normalized + query;
}

function toPosixPath(path: string) {
  return path.replace(/\\/g, "/");
}
