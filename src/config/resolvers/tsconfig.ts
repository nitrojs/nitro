import type { NitroOptions } from "nitro/types";
import type { TSConfig } from "pkg-types";
import { join, resolve } from "pathe";
import * as tsco from "tsconfck";

export async function resolveTsconfig(options: NitroOptions) {
  const root = resolve(options.rootDir || ".") + "/";
  if (!options.typescript.tsConfig) {
    options.typescript.tsConfig = await loadTsconfig(root);
  }
}

async function loadTsconfig(root: string): Promise<TSConfig> {
  const opts: tsco.TSConfckParseOptions = {
    root,
    cache: ((loadTsconfig as any)["__cache"] ??= new tsco.TSConfckCache()),
    ignoreNodeModules: true,
  };
  const tsConfigPath = join(root, "tsconfig.json");
  const parsed = await tsco.parse(tsConfigPath, opts).catch(() => undefined);
  if (!parsed) return {} as TSConfig;
  const { tsconfig, tsconfigFile } = parsed;
  tsconfig.compilerOptions ??= {};
  if (!tsconfig.compilerOptions.baseUrl) {
    tsconfig.compilerOptions.baseUrl = resolve(tsconfigFile, "..");
  }
  return tsconfig;
}
