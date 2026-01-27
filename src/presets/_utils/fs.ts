import fsp from "node:fs/promises";
import { relative, dirname } from "pathe";
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
