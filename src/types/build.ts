import type {
  InputOptions as RollupInputOptions,
  OutputOptions as RollupOutputOptions,
} from "rollup";
import type {
  InputOptions as RolldownInputOptions,
  OutputOptions as RolldownOutputOptions,
} from "rolldown";
import type { MinifyOptions } from "oxc-minify";
import type { JsxOptions, TransformOptions } from "oxc-transform";

export type RollupConfig = RollupInputOptions & {
  output: RollupOutputOptions;
};

export type RolldownConfig = RolldownInputOptions & {
  output: RolldownOutputOptions;
};

export interface OXCOptions {
  minify?: MinifyOptions;
  transform?: Omit<TransformOptions, "jsx"> & { jsx?: JsxOptions };
}
