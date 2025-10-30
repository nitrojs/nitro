import { runtimeDir } from "nitro/runtime/meta";
import type { Plugin } from "rollup";

export function virtualsResolve(): Plugin {
  return {
    name: "nitro:virtuals-resolve",
    resolveId: {
      order: "pre",
      handler(id, importer, rOpts) {
        if (importer && importer.startsWith("\0virtual:")) {
          return this.resolve(id, runtimeDir, {
            ...rOpts,
            skipSelf: true,
            custom: { ...rOpts.custom, skipNoExternals: true },
          });
        }
      },
    },
  };
}
