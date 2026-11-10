import { consola } from "consola";
import type { NitroOptions } from "nitro/types";

export function resolveDepsOptions(options: NitroOptions) {
  const paths = ((options.deps ??= {}).paths ??= {});
  // `vite.path` is an alias of `deps.paths.vite`
  const vitePath = options.vite?.path;
  if (vitePath && paths.vite && vitePath !== paths.vite) {
    consola.warn(
      `Both \`vite.path\` (\`${vitePath}\`) and \`deps.paths.vite\` (\`${paths.vite}\`) are set. Using \`deps.paths.vite\`.`
    );
  }
  if (vitePath) {
    paths.vite ??= vitePath;
  }
  if (paths.vite) {
    (options.vite ??= {}).path = paths.vite;
  }
}
