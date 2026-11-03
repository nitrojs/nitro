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

/**
 * [`Bun.build`](https://bun.com/docs/bundler) options used by the `bun` builder.
 *
 * Nitro's build plugins run in a single Bun plugin (`nitro:plugins`) of `plugins`.
 */
export interface BunConfig {
  entrypoints?: string[];
  root?: string;
  target?: "bun" | "node" | "browser";
  format?: "esm" | "cjs" | "iife";
  splitting?: boolean;
  external?: string[];
  packages?: "bundle" | "external";
  conditions?: string | string[];
  naming?: string | { entry?: string; chunk?: string; asset?: string };
  minify?: boolean | { whitespace?: boolean; syntax?: boolean; identifiers?: boolean };
  sourcemap?: boolean | "none" | "linked" | "inline" | "external";
  define?: Record<string, string>;
  loader?: Record<string, string>;
  banner?: string;
  footer?: string;
  drop?: string[];
  jsx?: {
    runtime?: "automatic" | "classic";
    importSource?: string;
    factory?: string;
    fragment?: string;
    development?: boolean;
  };
  env?: "inline" | "disable" | `${string}*`;
  metafile?: boolean;
  plugins?: { name: string; setup: (build: any) => void | Promise<void> }[];
  /** Other `Bun.build` options. */
  [key: string]: any;
}

/**
 * Bundler config passed to the `build:config` hook, keyed by the bundler in use.
 *
 * The `vite` builder passes a Rollup or Rolldown config, depending on the Vite version.
 */
export type NitroBuildConfig =
  | { builder: "rollup" | "vite"; rollup: RollupConfig; rolldown?: never; bun?: never }
  | { builder: "rolldown" | "vite"; rolldown: RolldownConfig; rollup?: never; bun?: never }
  | { builder: "bun"; bun: BunConfig; rollup?: never; rolldown?: never };

export interface OXCOptions {
  minify?: OptionalDepType<RolldownMinifyOptions, BundlerMinifyOptions>;
  transform?: Omit<OXCTransformOptions, "jsx"> & {
    jsx?: Exclude<OXCTransformOptions["jsx"], false | string>;
  };
}

type MaybePromise<T> = T | Promise<T>;

type MaybeArray<T> = T | readonly T[];
