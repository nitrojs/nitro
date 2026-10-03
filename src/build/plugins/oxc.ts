import type { Nitro, OXCOptions } from "nitro/types";
import type { Plugin } from "rollup";
import { importOXC } from "../../utils/oxc.ts";
import { RESOLVED_RE as rawModulesRE } from "./raw.ts";

export async function oxc(
  nitro: Nitro,
  options: OXCOptions & { sourcemap: boolean; minify: boolean | OXCOptions["minify"] }
): Promise<Plugin> {
  const { transformSync, minifySync } = await importOXC({ dir: nitro.options.rootDir });
  if (options.minify && !minifySync) {
    nitro.logger.warn(
      "Skipping minification: the `rollup` builder minifies with `rolldown`. Install `rolldown` to enable it."
    );
  }
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
      if (options.minify && minifySync) {
        return minifySync(chunk.fileName, code, {
          sourcemap: options.sourcemap,
          ...(typeof options.minify === "object" ? options.minify : {}),
        });
      }
    },
  };
}
