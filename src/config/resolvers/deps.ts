import type { NitroOptions } from "nitro/types";

export function resolveDepsOptions(options: NitroOptions) {
  options.deps ??= {};
  // `vite.path` is an alias of `deps.vite`
  if (options.vite?.path) {
    options.deps.vite ??= options.vite.path;
  }
  if (options.deps.vite) {
    (options.vite ??= {}).path = options.deps.vite;
  }
}
