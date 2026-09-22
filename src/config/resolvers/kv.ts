import consola from "consola";
import type { NitroOptions } from "nitro/types";
import { ensureLibDeps } from "../../utils/dep.ts";
import { resolveDriverDeps, resolveStorageMounts } from "../../utils/storage.ts";

export async function resolveKVOptions(options: NitroOptions) {
  options.kv ??= {};
  if (
    options.storage &&
    options.storage !== options.kv &&
    Object.keys(options.storage).length > 0
  ) {
    consola.warn(`"storage" option is deprecated. Please use "kv" instead.`);
    options.kv = { ...options.storage, ...options.kv };
  }
  options.storage = options.kv;

  if (options.devStorage && Object.keys(options.devStorage).length > 0) {
    consola.warn(
      `"devStorage" option is deprecated. Please use "kv" inside "$development" config instead.`
    );
  }

  // Storage drivers lazily import their third-party dependencies.
  // Make sure the ones required by the configured mounts are installed.
  await ensureLibDeps(
    resolveStorageMounts(options).map((mount) => ({
      name: mount.name,
      options: mount.options,
      deps: resolveDriverDeps(mount.name),
    })),
    { dir: options.rootDir, label: "storage driver" }
  );
}
