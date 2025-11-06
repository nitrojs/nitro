import type { NitroOptions } from "nitro/types";
import { loadTsconfig, tsConfigToAliasObj } from "../../utils/tsconfig.ts";
import { resolve } from "pathe";

export async function resolveTypescript(options: NitroOptions) {
  const root = resolve(options.rootDir || ".") + "/";
  if (!options.typescript.tsConfig) {
    options.typescript.tsConfig = await loadTsconfig(root);
  }
  if (
    options.experimental.tsconfigAliases !== false &&
    options.typescript.tsConfig.compilerOptions?.paths
  ) {
    options.alias = {
      ...tsConfigToAliasObj(options.typescript.tsConfig, root),
      ...options.alias,
    };
  }
}
