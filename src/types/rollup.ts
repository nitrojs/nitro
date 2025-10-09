import type { FilterPattern } from "unplugin-utils";
import type { Loader as ESBuildLoader } from "esbuild";
import type { TransformOptions as ESBuildTransformOptions } from "esbuild";
import type {
  InputOptions as RollupInputOptions,
  OutputOptions as RollupOutputOptions,
} from "rollup";

export type { ExternalsPluginOptions as NodeExternalsOptions } from "nf3";

export type RollupConfig = RollupInputOptions & {
  output: RollupOutputOptions;
};

export type VirtualModule = string | (() => string | Promise<string>);

export interface RollupVirtualOptions {
  [id: string]: VirtualModule;
}

export interface EsbuildOptions extends ESBuildTransformOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
  sourceMap?: boolean | "inline" | "hidden";
  /**
   * Map extension to esbuild loader
   * Note that each entry (the extension) needs to start with a dot
   */
  loaders?: {
    [ext: string]: ESBuildLoader | false;
  };
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

export interface RawOptions {
  extensions?: string[];
}
