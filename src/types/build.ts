import type {
  InputOptions as RollupInputOptions,
  InputPluginOption as RollupInputPluginOption,
  OutputOptions as RollupOutputOptions,
} from "rollup";

import type {
  InputOptions as RolldownInputOptions,
  OutputOptions as RolldownOutputOptions,
  MinifyOptions as RolldownMinifyOptions,
  RolldownPluginOption,
  TransformOptions as RolldownTransformOptions,
} from "rolldown";

export type RollupConfig = Omit<RollupInputOptions, "plugins"> & {
  output?: RollupOutputOptions;
  // Vite 8 / `@vitejs/plugin-vue` etc. return Rolldown-typed plugins now that
  // Vite's `Plugin` extends `Rolldown.Plugin` instead of Rollup's own type.
  // `rollupConfig` is also reused for the `rolldown` builder (see
  // `build/vite/bundler.ts`), so accept a mix of Rollup and Rolldown plugins
  // in the same array.
  plugins?: (RollupInputPluginOption | RolldownPluginOption)[];
};

export type RolldownConfig = RolldownInputOptions & {
  output?: RolldownOutputOptions;
};

export interface OXCOptions {
  minify?: RolldownMinifyOptions;
  transform?: Omit<RolldownTransformOptions, "jsx"> & {
    jsx?: Exclude<RolldownTransformOptions["jsx"], false | string>;
  };
}
