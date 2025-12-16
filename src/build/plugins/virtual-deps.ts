import { runtimeDependencies, runtimeDir } from "nitro/meta";
import type { Plugin, ResolvedId } from "rollup";
import { pathRegExp } from "../../utils/regex.ts";

export function nitroVirtualDeps(): Plugin {
  const cache = new Map<
    string,
    ResolvedId | null | Promise<ResolvedId | null>
  >();

  return {
    name: "nitro:vfs-runtime-deps",
    resolveId: {
      order: "pre",
      filter: {
        id: new RegExp(
          `^(${runtimeDependencies.map((dep) => pathRegExp(dep)).join("|")})`
        ),
      },
      handler(id, importer) {
        // https://github.com/rolldown/rolldown/issues/7529
        if (!importer || !importer.startsWith("#nitro/virtual")) {
          return;
        }
        let resolved = cache.get(id);
        if (!resolved) {
          resolved = this.resolve(id, runtimeDir)
            .then((_resolved) => {
              cache.set(id, _resolved);
              return _resolved;
            })
            .catch((error) => {
              cache.delete(id);
              throw error;
            });
        }
        return resolved;
      },
    },
  };
}
