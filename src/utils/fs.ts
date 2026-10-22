import type { Nitro } from "nitro/types";
import { randomBytes } from "node:crypto";
import { stat, mkdir, rename, rm, writeFile as fspWriteFile } from "node:fs/promises";
import { dirname, join } from "pathe";
import consola from "consola";
import { colors } from "consola/utils";
import { getProperty } from "dot-prop";
import { relative, resolve } from "pathe";

export function prettyPath(p: string, highlight = true) {
  p = relative(process.cwd(), p);
  return highlight ? colors.cyan(p) : p;
}

export function resolveNitroPath(
  path: string,
  nitroOptions: Nitro["options"],
  base?: string
): string {
  if (typeof path !== "string") {
    throw new TypeError("Invalid path: " + path);
  }

  // TODO: Skip if no template used
  path = _compilePathTemplate(path)(nitroOptions);
  for (const base in nitroOptions.alias) {
    if (path.startsWith(base)) {
      path = nitroOptions.alias[base] + path.slice(base.length);
    }
  }

  // eslint-disable-next-line no-control-regex
  if (/^[#\u0000]/.test(path)) {
    return path;
  }

  return resolve(base || nitroOptions.rootDir, path);
}

function _compilePathTemplate(contents: string) {
  return (params: Record<string, any>) =>
    contents.replace(/{{ ?([\w.]+) ?}}/g, (_, match) => {
      const val = getProperty<Record<string, string>, string>(params, match);
      if (!val) {
        consola.warn(`cannot resolve template param '${match}' in ${contents.slice(0, 20)}`);
      }
      return val || `${match}`;
    });
}

export async function writeFile(file: string, contents: Buffer | string, log = false) {
  await mkdir(dirname(file), { recursive: true });
  await fspWriteFile(file, contents, typeof contents === "string" ? "utf8" : undefined);
  if (log) {
    consola.info("Generated", prettyPath(file));
  }
}

/**
 * Write to a sibling temp file and rename it into place. `rename` is atomic within a
 * filesystem, so concurrent writers to one path produce last-one-wins instead of a file
 * torn between their payloads.
 */
export async function writeFileAtomic(file: string, contents: Buffer | string) {
  const dir = dirname(file);
  await mkdir(dir, { recursive: true });
  // Named independently of `file`, so a name close to the length limit still fits
  const tmpFile = join(dir, `.nitro-${randomBytes(6).toString("hex")}.tmp`);
  try {
    await fspWriteFile(tmpFile, contents, typeof contents === "string" ? "utf8" : undefined);
    await _renameWithRetry(tmpFile, file);
  } catch (error) {
    await rm(tmpFile, { force: true }).catch(() => {});
    throw error;
  }
}

export async function isDirectory(path: string) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

const _RENAME_RETRY_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

// On Windows, replacing a file another process holds open (antivirus, indexer) fails transiently
async function _renameWithRetry(from: string, to: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || attempt >= 10 || !_RENAME_RETRY_CODES.has(code!)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 10));
    }
  }
}
