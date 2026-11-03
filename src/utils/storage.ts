import type { NitroDepsOptions, NitroOptions } from "nitro/types";
import type { BuiltinDriverName } from "unstorage";
import { importDep } from "./dep.ts";
import type { LibDep } from "./dep.ts";

export interface KVMountConfig {
  /** Mount point path. */
  path: string;
  /** Driver name as configured by the user. */
  name: string;
  /** Driver options. */
  options: Record<string, any>;
}

export interface ResolvedKVMount extends KVMountConfig {
  /** Module id to import the driver from. */
  driver: string;
  /**
   * Third-party dependencies of a builtin driver.
   *
   * Since `unstorage` v2, they are not declared as optional peer dependencies anymore.
   */
  deps: LibDep[];
}

/** KV mounts configured for the current build. */
export function resolveKVMounts(options: NitroOptions): KVMountConfig[] {
  const isDevOrPrerender = options.dev || options.preset === "nitro-prerender";
  const mounts = isDevOrPrerender ? { ...options.kv, ...options.devStorage } : options.kv;
  return Object.entries(mounts).map(([path, { driver: name, ...driverOpts }]) => ({
    path,
    name,
    options: driverOpts,
  }));
}

/** Resolve the driver modules of the configured KV mounts (`unstorage` is imported on demand). */
export async function resolveKVDrivers(options: NitroOptions): Promise<ResolvedKVMount[]> {
  const mounts = resolveKVMounts(options);
  if (mounts.length === 0) {
    return [];
  }
  const { builtinDrivers, builtinDriverDependencies } = await importUnstorage({
    dir: options.rootDir,
    deps: options.deps,
    reason: "the `kv` config",
  });
  return mounts.map((mount) => ({
    ...mount,
    driver: builtinDrivers[mount.name as BuiltinDriverName] || mount.name,
    deps: Object.entries(builtinDriverDependencies[mount.name as BuiltinDriverName] || {}).map(
      ([option, dep]) => ({ option, ...dep })
    ),
  }));
}

/** Import `unstorage` from the project, installing it on demand. */
export function importUnstorage(opts: {
  dir: string;
  deps?: NitroDepsOptions;
  reason: string;
}): Promise<typeof import("unstorage")> {
  return importDep({ id: "unstorage", ...opts });
}
