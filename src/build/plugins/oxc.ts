import type { MinifyOptions } from "rolldown/experimental";
import type { OXCOptions } from "nitro/types";
import type { Plugin } from "rollup";

export async function oxc(
  options: OXCOptions & { sourcemap: boolean; minify: boolean | MinifyOptions }
): Promise<Plugin> {
  const { minifySync, transformSync } = await import("rolldown/experimental");
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
