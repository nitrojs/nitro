import type { FilterPattern } from "unplugin-utils";
import type { NodeFileTraceOptions } from "@vercel/nft";
import type { Loader as ESBuildLoader } from "esbuild";
import type { TransformOptions as ESBuildTransformOptions } from "esbuild";
import type {
  InputOptions as RollupInputOptions,
  OutputOptions as RollupOutputOptions,
} from "rollup";

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

export interface NodeExternalsOptions {
  inline?: Array<
    | string
    | RegExp
    | ((id: string, importer?: string) => Promise<boolean> | boolean)
  >;
  external?: Array<
    | string
    | RegExp
    | ((id: string, importer?: string) => Promise<boolean> | boolean)
  >;
  rootDir?: string;
  outDir: string;
  trace?: boolean;
  traceOptions?: NodeFileTraceOptions;
  moduleDirectories?: string[];
  exportConditions?: string[];
  traceInclude?: string[];
  traceAlias?: Record<string, string>;
  chmod?: boolean | number;
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
