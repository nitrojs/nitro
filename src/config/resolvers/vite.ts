import { consola } from "consola";
import { defu } from "defu";
import type { NitroOptions } from "nitro/types";

let _warned = false;

type ViteOptionsSource = {
  vite?: NitroOptions["vite"];
  experimental?: NitroOptions["experimental"] | undefined;
};

export async function resolveViteOptions(options: ViteOptionsSource) {
  const experimental = options.experimental;
  const legacy = experimental?.vite;
  if (!legacy) {
    return;
  }
  if (!_warned) {
    _warned = true;
    consola.warn(
      "`experimental.vite` is deprecated. Move its options (`services`, `assetsImport` and `serverReload`) to the top-level `vite` option."
    );
  }
  options.vite = defu(options.vite || {}, legacy);
  delete experimental.vite;
}
