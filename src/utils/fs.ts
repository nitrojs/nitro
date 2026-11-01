import type { Nitro } from "nitro/types";
import { randomBytes } from "node:crypto";
import { stat, mkdir, rm, writeFile as fspWriteFile } from "node:fs/promises";
import { dirname, join } from "pathe";
import consola from "consola";
import { colors } from "consola/utils";
import { getProperty } from "dot-prop";
import { relative, resolve } from "pathe";
import { resolveAlias } from "pathe/utils";

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
  path = resolveAlias(path, nitroOptions.alias);

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

export async function isDirectory(path: string) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Whether `dir` is on a case-insensitive filesystem (the default on macOS and Windows,
 * but not on every volume), probed by looking up a temp file by its upper-cased name.
 */
export async function isCaseInsensitiveFS(dir: string) {
  await mkdir(dir, { recursive: true });
  const name = `.nitro-case-${randomBytes(6).toString("hex")}`;
  const probe = join(dir, name);
  await fspWriteFile(probe, "");
  try {
    await stat(join(dir, name.toUpperCase()));
    return true;
  } catch {
    return false;
  } finally {
    await rm(probe, { force: true });
  }
}
