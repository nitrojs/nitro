import fsp from "node:fs/promises";
import { relative, dirname, join } from "pathe";
import consola from "consola";
import { colors } from "consola/utils";

export function prettyPath(p: string, highlight = true) {
  p = relative(process.cwd(), p);
  return highlight ? colors.cyan(p) : p;
}

export async function writeFile(file: string, contents: Buffer | string, log = false) {
  await fsp.mkdir(dirname(file), { recursive: true });
  await fsp.writeFile(file, contents, typeof contents === "string" ? "utf8" : undefined);
  if (log) {
    consola.info("Generated", prettyPath(file));
  }
}

export async function isDirectory(path: string) {
  try {
    return (await fsp.stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recursively recreate `src` at `dest` using hard links for files.
 *
 * Hard links share inodes with the source, so deployment targets that
 * read files into per-function bundles (e.g. Vercel Lambda packaging)
 * see them as regular files while local disk usage stays flat.
 *
 * Directories cannot be hard-linked, so the tree is recreated and each
 * file is linked individually. Symlinks are preserved as symlinks.
 * Falls back to `copyFile` when crossing filesystems (`EXDEV`) or when
 * the platform refuses the link operation (`EPERM`).
 *
 * Entries listed in `skip` are ignored at the top level only.
 */
export async function hardLinkDir(src: string, dest: string, options: { skip?: Set<string> } = {}) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (options.skip?.has(entry.name)) {
      continue;
    }
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await hardLinkDir(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const target = await fsp.readlink(srcPath);
      await fsp.symlink(target, destPath);
    } else {
      try {
        await fsp.link(srcPath, destPath);
      } catch (err: any) {
        if (err?.code === "EXDEV" || err?.code === "EPERM") {
          await fsp.copyFile(srcPath, destPath);
        } else {
          throw err;
        }
      }
    }
  }
}
