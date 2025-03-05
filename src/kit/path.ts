import consola from "consola";
import { colors } from "consola/utils";
import { getProperty } from "dot-prop";
import type { Nitro } from "nitro/types";
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

  return resolve(base || nitroOptions.srcDir, path);
}

function _compilePathTemplate(contents: string) {
  return (params: Record<string, any>) =>
    contents.replace(/{{ ?([\w.]+) ?}}/g, (_, match) => {
      const val = getProperty<Record<string, string>, string>(params, match);
      if (!val) {
        consola.warn(
          `cannot resolve template param '${match}' in ${contents.slice(0, 20)}`
        );
      }
      return val || `${match}`;
    });
}
