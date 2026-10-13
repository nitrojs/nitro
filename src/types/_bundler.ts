// Fallback Rollup and Rolldown option types, used when they are not installed (see `OptionalDepType`)

type MaybeArray<T> = T | T[];
type MaybePromise<T> = T | Promise<T>;

export interface BundlerInputOptions {
  input?: string | string[] | Record<string, string>;
  external?:
    | MaybeArray<string | RegExp>
    | ((source: string, importer: string | undefined, isResolved: boolean) => boolean | void);
  treeshake?: boolean | Record<string, any>;
  onwarn?: (warning: any, defaultHandler: (warning: any) => void) => void;
  onLog?: (
    level: "info" | "debug" | "warn",
    log: any,
    defaultHandler: (...args: any[]) => void
  ) => void;
  logLevel?: "info" | "debug" | "warn" | "silent";
  preserveEntrySignatures?: false | "strict" | "allow-extension" | "exports-only";
  context?: string;
  moduleContext?: Record<string, string> | ((id: string) => string | null | undefined);
  /** Rolldown only. */
  platform?: "node" | "browser" | "neutral";
  /** Rolldown only. */
  resolve?: Record<string, any>;
  /** Rolldown only. */
  transform?: Record<string, any>;
  /** Rolldown only. */
  checks?: Record<string, any>;
  /** Builder-specific options. */
  [key: string]: any;
}

export interface BundlerOutputOptions {
  dir?: string;
  file?: string;
  format?: "es" | "esm" | "module" | "cjs" | "commonjs" | "iife" | "umd" | "amd" | "system";
  entryFileNames?: string | ((chunkInfo: any) => string);
  chunkFileNames?: string | ((chunkInfo: any) => string);
  assetFileNames?: string | ((assetInfo: any) => string);
  sourcemap?: boolean | "inline" | "hidden";
  sourcemapExcludeSources?: boolean;
  sourcemapIgnoreList?: boolean | ((source: string, sourcemapPath: string) => boolean);
  sourcemapPathTransform?: (source: string, sourcemapPath: string) => string;
  banner?: string | ((chunk: any) => MaybePromise<string>);
  footer?: string | ((chunk: any) => MaybePromise<string>);
  intro?: string | ((chunk: any) => MaybePromise<string>);
  outro?: string | ((chunk: any) => MaybePromise<string>);
  exports?: "auto" | "default" | "named" | "none";
  inlineDynamicImports?: boolean;
  /** Rollup only. */
  manualChunks?: Record<string, string[]> | ((id: string, meta: any) => string | null | undefined);
  /** Rolldown only. */
  codeSplitting?: boolean | Record<string, any>;
  /** Rolldown only. */
  minify?: boolean | "dce-only" | Record<string, any>;
  /** Builder-specific options. */
  [key: string]: any;
}

/** Rolldown (oxc) minifier options. */
export interface BundlerMinifyOptions {
  module?: boolean;
  compress?: boolean | Record<string, any>;
  mangle?: boolean | Record<string, any>;
  mangleProps?: Record<string, any>;
  codegen?: boolean | Record<string, any>;
  sourcemap?: boolean;
}

type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null;
type RequireReturnsDefaultOption = boolean | "auto" | "preferred" | "namespace";
type DefaultIsModuleExportsOption = boolean | "auto";

/** `@rollup/plugin-commonjs` options. */
export interface CommonJSOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
  extensions?: ReadonlyArray<string>;
  ignoreGlobal?: boolean;
  sourceMap?: boolean;
  ignoreDynamicRequires?: boolean;
  transformMixedEsModules?: boolean;
  strictRequires?: boolean | FilterPattern;
  ignore?: ReadonlyArray<string> | ((id: string) => boolean);
  ignoreTryCatch?:
    | boolean
    | "remove"
    | ReadonlyArray<string>
    | ((id: string) => boolean | "remove");
  esmExternals?: boolean | ReadonlyArray<string> | ((id: string) => boolean);
  requireReturnsDefault?:
    | RequireReturnsDefaultOption
    | ((id: string) => RequireReturnsDefaultOption);
  defaultIsModuleExports?:
    | DefaultIsModuleExportsOption
    | ((id: string) => DefaultIsModuleExportsOption);
  dynamicRequireTargets?: string | ReadonlyArray<string>;
  dynamicRequireRoot?: string;
  requireNodeBuiltins?: boolean;
}
