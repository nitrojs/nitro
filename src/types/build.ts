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
} from "rolldown";
import type {
  BundlerInputOptions,
  BundlerMinifyOptions,
  BundlerOutputOptions,
} from "./_bundler.ts";
import type { OptionalDepType } from "./_utils.ts";
import type { TransformOptions as OXCTransformOptions } from "oxbox";

/**
 * A build plugin (Rollup plugin interface), applied with every builder.
 *
 * Rollup, Rolldown and Vite plugins are accepted. Only `resolveId`, `load` and `transform` are
 * supported by all builders (`builder: false` runs plugins in env-runner, which supports only
 * these).
 */
export interface NitroBuildPlugin {
  name: string;
  /** Run before (`"pre"`) or after (`"post"`) the other plugins. */
  enforce?: "pre" | "post";
  resolveId?: NitroBuildPluginHook<
    (this: any, source: string, importer: string | undefined, options: any) => any
  >;
  load?: NitroBuildPluginHook<(this: any, id: string, options?: any) => any>;
  transform?: NitroBuildPluginHook<(this: any, code: string, id: string, options?: any) => any>;
  /** Builder-specific hooks and options. */
  [key: string]: any;
}

export type NitroBuildPluginHook<Handler> =
  | Handler
  | {
      order?: "pre" | "post" | null;
      filter?: NitroBuildPluginHookFilter | readonly unknown[];
      handler: Handler;
    };

export interface NitroBuildPluginHookFilter {
  id?: NitroBuildPluginStringFilter;
  code?: NitroBuildPluginStringFilter;
  moduleType?: NitroBuildPluginStringFilter;
}

export type NitroBuildPluginStringFilter =
  | MaybeArray<string | RegExp>
  | { include?: MaybeArray<string | RegExp>; exclude?: MaybeArray<string | RegExp> };

/** `buildPlugins` entries: nested arrays and promises are resolved, falsy ones skipped. */
export type NitroBuildPluginOption = MaybePromise<
  NitroBuildPlugin | false | null | undefined | NitroBuildPluginOption[]
>;

export type RollupConfig = OptionalDepType<
  Omit<RollupInputOptions, "plugins">,
  BundlerInputOptions
> & {
  output?: OptionalDepType<RollupOutputOptions, BundlerOutputOptions>;
  // `rollupConfig` is also reused for the `rolldown` builder (see `build/vite/bundler.ts`),
  // so it accepts a mix of Rollup, Rolldown and Vite plugins.
  plugins?: (
    | OptionalDepType<RollupInputPluginOption, NitroBuildPluginOption>
    | OptionalDepType<RolldownPluginOption, NitroBuildPluginOption>
  )[];
};

export type RolldownConfig = OptionalDepType<
  RolldownInputOptions,
  BundlerInputOptions & { plugins?: NitroBuildPluginOption[] }
> & {
  output?: OptionalDepType<RolldownOutputOptions, BundlerOutputOptions>;
};

export interface OXCOptions {
  minify?: OptionalDepType<RolldownMinifyOptions, BundlerMinifyOptions>;
  transform?: Omit<OXCTransformOptions, "jsx"> & {
    jsx?: Exclude<OXCTransformOptions["jsx"], false | string>;
  };
}

type MaybePromise<T> = T | Promise<T>;

type MaybeArray<T> = T | readonly T[];
