import type { NitroOptions } from "nitro/types";
import { ensureLibDeps } from "../../utils/dep.ts";
import { resolveDriverDeps, resolveStorageMounts } from "../../utils/storage.ts";

export async function resolveStorageOptions(options: NitroOptions) {
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
