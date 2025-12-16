import type {
  InputOptions as RollupInputOptions,
  OutputOptions as RollupOutputOptions,
} from "rollup";
import type { MinifyOptions } from "oxc-minify";
import type { JsxOptions, TransformOptions } from "oxc-transform";

export type RollupConfig = RollupInputOptions & {
  output: RollupOutputOptions;
};

export type VirtualModule = string | (() => string | Promise<string>);

export interface RollupVirtualOptions {
  [id: string]: VirtualModule;
}

export interface OXCOptions {
  minify?: MinifyOptions;
  transform?: Omit<TransformOptions, "jsx"> & { jsx?: JsxOptions };
}

export interface ServerAssetOptions {
  inline: boolean;
  dirs: {
    [assetdir: string]: {
      dir: string;
      meta?: boolean;
    };
  };
}
