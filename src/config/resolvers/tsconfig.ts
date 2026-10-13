import type { NitroOptions } from "nitro/types";
import type { TSConfig } from "pkg-types";
import { join, resolve } from "pathe";
import { parseTsconfig } from "get-tsconfig";

const tsconfigCache = new Map<string, any>();

export async function resolveTsconfig(options: NitroOptions) {
  const root = resolve(options.rootDir || ".") + "/";
  if (!options.typescript.tsConfig) {
    options.typescript.tsConfig = loadTsconfig(root);
  }
}

function loadTsconfig(root: string): TSConfig {
  const tsConfigPath = join(root, "tsconfig.json");
  let tsconfig: TSConfig;
  try {
    tsconfig = parseTsconfig(tsConfigPath, tsconfigCache) as TSConfig;
  } catch {
    return {} as TSConfig;
  }
  tsconfig.compilerOptions ??= {};
  if (!tsconfig.compilerOptions.baseUrl) {
    tsconfig.compilerOptions.baseUrl = resolve(tsConfigPath, "..");
  }
  return tsconfig;
}
