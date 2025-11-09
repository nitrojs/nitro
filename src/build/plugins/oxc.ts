import { minify, type MinifyOptions } from "oxc-minify";
import { transform } from "oxc-transform";
import type { OXCOptions } from "nitro/types";
import type { Plugin } from "rollup";

export function oxc(
  options: OXCOptions & { sourcemap: boolean; minify: boolean | MinifyOptions }
): Plugin {
  const filter = (id: string) =>
    !/node_modules/.test(id) && /\.[mj]?[jt]sx?$/.test(id);

  return {
    name: "nitro:oxc",
    async transform(code, id) {
      if (!filter(id)) {
        return null;
      }
      return transform(id, code, {
        sourcemap: options.sourcemap,
        ...options.transform,
      });
    },

    async renderChunk(code, chunk) {
      if (options.minify) {
        return minify(chunk.fileName, code, {
          sourcemap: options.sourcemap,
          ...(typeof options.minify === "object" ? options.minify : {}),
        });
      }
      return null;
    },
  };
}
