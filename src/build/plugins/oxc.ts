import type { MinifyOptions } from "rolldown/experimental";
import type { OXCOptions } from "nitro/types";
import type { Plugin } from "rollup";
import { RESOLVED_RE as rawModulesRE } from "./raw.ts";

export async function oxc(
  options: OXCOptions & { sourcemap: boolean; minify: boolean | MinifyOptions }
): Promise<Plugin> {
  const { minifySync, transformSync } = await import("rolldown/utils");
  return {
    name: "nitro:oxc",
    transform: {
      filter: {
        // Raw modules are already plain JS holding file contents; no need to transpile
        id: { include: /^(?!.*\/node_modules\/).*\.m?[jt]sx?$/, exclude: rawModulesRE },
      },
      handler(code, id) {
        const res = transformSync(id, code, {
          sourcemap: options.sourcemap,
          tsconfig: false,
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
