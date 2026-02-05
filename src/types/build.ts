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

export type RollupConfig = RollupInputOptions & {
  output: RollupOutputOptions;
};

export type RolldownConfig = RolldownInputOptions & {
  output: RolldownOutputOptions;
};

export interface OXCOptions {
  minify?: RolldownMinifyOptions;
  transform?: Omit<RolldownTransformOptions, "jsx"> & {
    jsx?: Exclude<RolldownTransformOptions["jsx"], false | string>;
  };
}
