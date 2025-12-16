import type { MinifyOptions } from "oxc-minify";
import type { OXCOptions } from "nitro/types";
import type { Plugin } from "rollup";

import { transformSync } from "oxc-transform";
import { minifySync } from "oxc-minify";

export function oxc(
  options: OXCOptions & { sourcemap: boolean; minify: boolean | MinifyOptions }
): Plugin {
  return {
    name: "nitro:oxc",
    transform: {
      filter: {
        id: /^(?!.*\/node_modules\/).*\.m?[jt]sx?$/,
      },
      handler(code, id) {
        const res = transformSync(id, code, {
          sourcemap: options.sourcemap,
          ...options.transform,
        });
        if (res.errors?.length > 0) {
          this.error(res.errors.join("\n"));
        }
        return res;
      },
    },
    renderChunk(code, chunk) {
      if (options.minify) {
        return minifySync(chunk.fileName, code, {
          sourcemap: options.sourcemap,
          ...(typeof options.minify === "object" ? options.minify : {}),
        });
      }
    },
  };
}
