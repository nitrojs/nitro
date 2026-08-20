import type { NitroOptions } from "nitro/types";
import { builtinDriverDependencies, builtinDrivers } from "unstorage";
import type { BuiltinDriverName } from "unstorage";

export interface StorageMount {
  /** Mount point path. */
  path: string;
  /** Driver name as configured by the user. */
  name: string;
  /** Module id to import the driver from. */
  driver: string;
  /** Driver options. */
  options: Record<string, any>;
}

export interface StorageDriverDep {
  /** Driver option the library can be provided with (e.g. `lib`). */
  option: string;
  /** Package name. */
  name: string;
  /** Supported version range. */
  version?: string;
  /** Only required for some of the driver features. */
  optional?: boolean;
}

/** Resolve storage mounts that will be used for the current build. */
export function resolveStorageMounts(options: NitroOptions): StorageMount[] {
  const isDevOrPrerender = options.dev || options.preset === "nitro-prerender";
  const mounts = isDevOrPrerender ? { ...options.storage, ...options.devStorage } : options.storage;
  return Object.entries(mounts).map(([path, { driver: name, ...driverOpts }]) => ({
    path,
    name,
    driver: builtinDrivers[name as BuiltinDriverName] || name,
    options: driverOpts,
  }));
}

/**
 * Third-party dependencies of a builtin driver.
 *
 * Since `unstorage` v2, they are not declared as optional peer dependencies anymore.
 */
export function resolveDriverDeps(name: string): StorageDriverDep[] {
  const deps = builtinDriverDependencies[name as BuiltinDriverName];
  return Object.entries(deps || {}).map(([option, dep]) => ({ option, ...dep }));
}

/** Driver options accepting a library import (`lib`, `identityLib`, ...). */
export function isLibOption(option: string): boolean {
  return option === "lib" || option.endsWith("Lib");
}
