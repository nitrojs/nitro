// Based on https://github.com/egoist/rollup-plugin-esbuild (MIT)

import { createFilter } from "unplugin-utils";
import { type Loader, type TransformResult, transform } from "esbuild";
import type { EsbuildOptions } from "nitropack/types";
import { extname, relative } from "pathe";
import type { Plugin, PluginContext } from "rollup";

const defaultLoaders: { [ext: string]: Loader } = {
  ".ts": "ts",
  ".js": "js",
  ".tsx": "tsx",
  ".jsx": "jsx",
};

export function esbuild(options: EsbuildOptions): Plugin {
  const {
    include,
    exclude,
    sourceMap,
    loaders: loadersConfig,
    minify,
    ...transformOptions
  } = options;

  const loaders = { ...defaultLoaders };
  if (loadersConfig) {
    for (const key of Object.keys(loadersConfig)) {
      const value = loadersConfig[key];
      if (typeof value === "string") {
        loaders[key] = value;
      } else if (value === false) {
        delete loaders[key];
      }
    }
  }

  const extensions: string[] = Object.keys(loaders);
  const INCLUDE_REGEXP = new RegExp(
    `\\.(${extensions.map((ext) => ext.slice(1)).join("|")})$`
  );
  const EXCLUDE_REGEXP = /node_modules/;

  const filter = createFilter(
    include || INCLUDE_REGEXP,
    exclude || EXCLUDE_REGEXP
  );

  return {
    name: "esbuild",

    async transform(code, id) {
      if (!filter(id)) {
        return null;
      }

      const ext = extname(id);
      const loader = loaders[ext];

      if (!loader) {
        return null;
      }

      const result = await transform(code, {
        sourcemap: sourceMap === "hidden" ? "external" : sourceMap,
        ...transformOptions,
        loader,
        sourcefile: id,
      });

      printWarnings(id, result, this);

      return (
        result.code && {
          code: result.code,
          map: result.map || null,
        }
      );
    },

    async renderChunk(code) {
      if (minify) {
        const result = await transform(code, {
          loader: "js",
          minify: true,
          target: transformOptions.target,
        });
        if (result.code) {
          return {
            code: result.code,
            map: result.map || null,
          };
        }
      }
      return null;
    },
  };
}

function printWarnings(
  id: string,
  result: TransformResult,
  plugin: PluginContext
) {
  if (result.warnings) {
    for (const warning of result.warnings) {
      let message = "[esbuild]";
      if (warning.location) {
        message += ` (${relative(process.cwd(), id)}:${warning.location.line}:${
          warning.location.column
        })`;
      }
      message += ` ${warning.text}`;
      plugin.warn(message);
    }
  }
}
