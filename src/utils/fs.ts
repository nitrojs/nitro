import type { Nitro } from "nitro/types";
import { stat, mkdir, writeFile as fspWriteFile } from "node:fs/promises";
import { dirname } from "pathe";
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

export async function isDirectory(path: string) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
