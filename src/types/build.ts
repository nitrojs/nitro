import type {
  InputOptions as RollupInputOptions,
  InputPluginOption as RollupInputPluginOption,
  OutputOptions as RollupOutputOptions,
  Plugin as RollupPlugin,
} from "rollup";

import type {
  InputOptions as RolldownInputOptions,
  OutputOptions as RolldownOutputOptions,
  MinifyOptions as RolldownMinifyOptions,
  RolldownPlugin,
  RolldownPluginOption,
} from "rolldown";
import type { TransformOptions as OXCTransformOptions } from "oxbox";
import type { EnvRunnerPlugin } from "env-runner";

/**
 * A plugin of the `buildPlugins` option: a Rollup, Rolldown, Vite or env-runner plugin.
 */
export type NitroBuildPlugin = (RollupPlugin | RolldownPlugin | EnvRunnerPlugin) & {
  enforce?: "pre" | "post";
};

/** `buildPlugins` entries: nested arrays and promises are resolved, falsy ones skipped. */
export type NitroBuildPluginOption = MaybePromise<
  NitroBuildPlugin | false | null | undefined | NitroBuildPluginOption[]
>;

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
  transform?: Omit<OXCTransformOptions, "jsx"> & {
    jsx?: Exclude<OXCTransformOptions["jsx"], false | string>;
  };
}

type MaybePromise<T> = T | Promise<T>;
