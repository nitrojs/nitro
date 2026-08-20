import consola from "consola";
import type { NitroOptions } from "nitro/types";
import { ensureDep } from "../../utils/dep.ts";
import { resolveDriverDeps, resolveStorageMounts } from "../../utils/storage.ts";

export async function resolveStorageOptions(options: NitroOptions) {
  // Storage drivers lazily import their third-party dependencies.
  // Make sure the ones required by the configured mounts are installed.
  const deps = new Map<string, { version?: string; drivers: Set<string> }>();
  for (const mount of resolveStorageMounts(options)) {
    for (const dep of resolveDriverDeps(mount.name)) {
      if (dep.optional || mount.options[dep.option] !== undefined) {
        continue; // Not required or explicitly provided by the user
      }
      const entry = deps.get(dep.name) || { version: dep.version, drivers: new Set() };
      entry.drivers.add(mount.name);
      deps.set(dep.name, entry);
    }
  }

  for (const [name, { version, drivers }] of deps) {
    const reason = `the ${[...drivers].map((d) => `\`${d}\``).join(", ")} storage driver${drivers.size > 1 ? "s" : ""}`;
    const resolved = await ensureDep({
      id: name,
      version,
      dir: options.rootDir,
      reason,
      dev: false,
    });
    if (!resolved) {
      consola.warn(`\`${name}\` is not installed. It is required for ${reason}.`);
    }
  }
}
