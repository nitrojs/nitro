import { runtimeDir } from "nitro/meta";
import type { Plugin } from "rollup";

const subpathMap = {
  "nitro/h3": "h3",
};

export function nitroResolveIds(): Plugin {
  return {
    name: "nitro:resolve-ids",
    resolveId: {
      order: "pre",
      handler(id, importer, rOpts) {
        // Resolve ids with a virtual template parent
        if (importer?.includes("#nitro/virtual")) {
          return this.resolve(id, runtimeDir, { ...rOpts });
        }
        // Resolve mapped subpaths
        const mappedId = subpathMap[id as keyof typeof subpathMap];
        if (mappedId) {
          return this.resolve(mappedId, runtimeDir, { skipSelf: true });
        }
      },
    },
  };
}
