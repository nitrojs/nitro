import type {
  InputOptions as RollupInputOptions,
  OutputOptions as RollupOutputOptions,
} from "rollup";

import type {
  InputOptions as RolldownInputOptions,
  OutputOptions as RolldownOutputOptions,
  MinifyOptions as RolldownMinifyOptions,
  TransformOptions as RolldownTransformOptions,
} from "rolldown";

import type { Configuration as RspackConfiguration } from "@rspack/core";

export type RollupConfig = RollupInputOptions & {
  output?: RollupOutputOptions;
};

export type RolldownConfig = RolldownInputOptions & {
  output?: RolldownOutputOptions;
};

export type RspackConfig = RspackConfiguration;

export interface OXCOptions {
  minify?: RolldownMinifyOptions;
  transform?: Omit<RolldownTransformOptions, "jsx"> & {
    jsx?: Exclude<RolldownTransformOptions["jsx"], false | string>;
  };
}
