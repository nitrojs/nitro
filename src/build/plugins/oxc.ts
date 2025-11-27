import type { MinifyOptions } from "oxc-minify";
import type { OXCOptions } from "nitro/types";
import type { Plugin } from "rollup";

import { transform } from "oxc-transform";

export async function oxc(
  options: OXCOptions & { sourcemap: boolean; minify: boolean | MinifyOptions }
): Promise<Plugin> {
  const minify = options.minify
    ? await import("oxc-minify").then((m) => m.minify)
    : null;

  return {
    name: "nitro:oxc",
    transform: {
      filter: {
        id: /^(?!.*\/node_modules\/).*\.[mj]?[jt]sx?$/,
      },
      async handler(code, id) {
        return transform(id, code, {
          sourcemap: options.sourcemap,
          ...options.transform,
        });
      },
    },
    async renderChunk(code, chunk) {
      return minify?.(chunk.fileName, code, {
        sourcemap: options.sourcemap,
        ...(typeof options.minify === "object" ? options.minify : {}),
      });
    },
  };
}
