import type { NitroOptions } from "nitro/types";
import type { TSConfig } from "pkg-types";
import { join, resolve } from "pathe";
import * as tsco from "tsconfck";

export async function resolveTsconfig(options: NitroOptions) {
  const root = resolve(options.rootDir || ".") + "/";
  if (!options.typescript.tsConfig) {
    options.typescript.tsConfig = await loadTsconfig(root);
  }
  if (options.experimental.tsconfigPaths && options.typescript.tsConfig.compilerOptions?.paths) {
    options.alias = {
      ...tsConfigToAliasObj(options.typescript.tsConfig, root),
      ...options.alias,
    };
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

function tsConfigToAliasObj(tsconfig: TSConfig, root: string): Record<string, string> {
  const compilerOptions = tsconfig?.compilerOptions;
  if (!compilerOptions?.paths) {
    return {};
  }
  const paths = compilerOptions.paths as Record<string, string[]>;
  const alias: Record<string, string> = {};
  for (const [key, targets] of Object.entries(paths)) {
    let source = key;
    let target = targets?.[0]; // choose the first target
    if (!target) continue;
    if (source.includes("*") || target.includes("*")) {
      source = source.replace(/\/\*$/, "");
      target = target.replace(/\/\*$/, "");
      if (source.includes("*") || target.includes("*")) continue; // skip complex patterns
    }
    if (target.startsWith(".")) {
      if (!compilerOptions.baseUrl) continue; // skip relative paths if no baseUrl is set
      target = resolve(root, compilerOptions.baseUrl, target) + (key.endsWith("*") ? "/" : "");
    }
    alias[source] = target;
  }
  return alias;
}
