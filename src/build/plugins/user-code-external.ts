import type { Plugin } from "rollup";
import type { Nitro } from "nitro/types";
import { isBuilderlessUserCodePath, splitSpecifier } from "../utils/builderless-path.ts";

export const BUILDERLESS_EXTERNAL_MARKER = "nitro:user-code-external";

export function userCodeExternal(nitro: Nitro): Plugin {
  return {
    name: BUILDERLESS_EXTERNAL_MARKER,
    resolveId: {
      order: "pre",
      handler(id) {
        const [path] = splitSpecifier(id);
        if (!path || !isBuilderlessUserCodePath(path, nitro)) {
          return null;
        }
        return {
          id,
          external: true,
          moduleSideEffects: true,
        };
      },
    },
  };
}
