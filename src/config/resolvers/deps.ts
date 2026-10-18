import type { NitroOptions } from "nitro/types";

export function resolveDepsOptions(options: NitroOptions) {
  const paths = ((options.deps ??= {}).paths ??= {});
  // `vite.path` is an alias of `deps.paths.vite`
  if (options.vite?.path) {
    paths.vite ??= options.vite.path;
  }
  if (paths.vite) {
    (options.vite ??= {}).path = paths.vite;
  }
}
