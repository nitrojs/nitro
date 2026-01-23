import type commonjs from "@rollup/plugin-commonjs";
import type { C12InputConfig, ConfigWatcher, DotenvOptions, ResolvedConfig } from "c12";
import type { WatchConfigOptions } from "c12";
import type { ChokidarOptions } from "chokidar";
import type { CompatibilityDateSpec, CompatibilityDates } from "compatx";
import type { LogLevel } from "consola";
import type { ConnectorName } from "db0";
import type { NestedHooks } from "hookable";
import type { ProxyServerOptions } from "httpxy";
import type { PresetName, PresetNameInput, PresetOptions } from "../presets/index.ts";
import type { TSConfig } from "pkg-types";
import type { Preset as UnenvPreset } from "unenv";
import type { UnimportPluginOptions } from "unimport/unplugin";
import type { BuiltinDriverName } from "unstorage";
import type { UnwasmPluginOptions } from "unwasm/plugin";
import type {
  EventHandlerFormat,
  NitroDevEventHandler,
  NitroErrorHandler,
  NitroEventHandler,
} from "./handler.ts";
import type { NitroHooks } from "./hooks.ts";
import type { NitroModuleInput } from "./module.ts";
import type { NitroFrameworkInfo } from "./nitro.ts";
import type { NitroOpenAPIConfig } from "./openapi.ts";
export type { NitroOpenAPIConfig } from "./openapi.ts";
import type { NitroPreset } from "./preset.ts";
import type { OXCOptions, RolldownConfig } from "./build.ts";
import type { RollupConfig } from "./build.ts";
import type { NitroRouteConfig, NitroRouteRules } from "./route-rules.ts";

type RollupCommonJSOptions = NonNullable<Parameters<typeof commonjs.default>[0]>;

/**
 * Nitro normalized options (nitro.options)
 */
export interface NitroOptions extends PresetOptions {
  // Internal
  _config: NitroConfig;
  _c12: ResolvedConfig<NitroConfig> | ConfigWatcher<NitroConfig>;
  _cli?: {
    command?: string;
  };

  // Compatibility
  compatibilityDate: CompatibilityDates;

  // General
  debug: boolean;
  preset: PresetName;
  static: boolean;
  logLevel: LogLevel;
  runtimeConfig: NitroRuntimeConfig;

  // Dirs
  workspaceDir: string;
  rootDir: string;
  serverDir: string | false;
  scanDirs: string[];
  apiDir: string;
  routesDir: string;
  buildDir: string;
  output: {
    dir: string;
    serverDir: string;
    publicDir: string;
  };

  /** @deprecated migrate to `serverDir` */
  srcDir: string;

  // Features
  storage: StorageMounts;
  devStorage: StorageMounts;
  database: DatabaseConnectionConfigs;
  devDatabase: DatabaseConnectionConfigs;
  renderer?: { handler?: string; static?: boolean; template?: string };
  ssrRoutes: string[];
  serveStatic: boolean | "node" | "deno" | "inline";
  noPublicDir: boolean;
  manifest?: {
    deploymentId?: string;
  };
  features: {
    /**
     * Enable runtime hooks for request and response.
     *
     * By default this feature will be enabled if there is at least one nitro plugin.
     */
    runtimeHooks?: boolean;

    /**
     * Enable WebSocket support
     */
    websocket?: boolean;
  };

  /**
   *
   * @see https://github.com/unjs/unwasm
   */
  wasm?: false | UnwasmPluginOptions;
  openAPI?: NitroOpenAPIConfig;
  experimental: {
    openAPI?: boolean;
    /**
     * See https://github.com/microsoft/TypeScript/pull/51669
     */
    typescriptBundlerResolution?: boolean;
    /**
     * Enable native async context support for useRequest()
     */
    asyncContext?: boolean;
    /**
     * Disable Experimental Sourcemap Minification
     */
    sourcemapMinify?: false;
    /**
     * Allow env expansion in runtime config
     *
     * @see https://github.com/nitrojs/nitro/pull/2043
     */
    envExpansion?: boolean;
    /**
     * Enable WebSocket support
     *
     * @see https://nitro.build/guide/websocket
     *
     * @deprecated use `features.websocket` instead.
     */
    websocket?: boolean;
    /**
     * Enable experimental Database support
     *
     * @see https://nitro.build/guide/database
     */
    database?: boolean;
    /**
     * Enable experimental Tasks support
     *
     * @see https://nitro.build/guide/tasks
     */
    tasks?: boolean;
    /**
     * Infer path aliases from tsconfig.json
     *
     * @default true
     */
    tsconfigPaths?: boolean;
  };
  future: {
    nativeSWR?: boolean;
  };
  serverAssets: ServerAssetDir[];
  publicAssets: PublicAssetDir[];

  imports: Partial<UnimportPluginOptions> | false;
  modules?: NitroModuleInput[];
  plugins: string[];
  tasks: { [name: string]: { handler?: string; description?: string } };
  scheduledTasks: { [cron: string]: string | string[] };
  virtual: Record<string, string | (() => string | Promise<string>)>;
  compressPublicAssets: boolean | CompressOptions;
  ignore: string[];

  // Dev
  dev: boolean;
  devServer: {
    port?: number;
    hostname?: string;
    watch?: string[];
  };
  watchOptions: ChokidarOptions;
  devProxy: Record<string, string | ProxyServerOptions>;

  // Logging
  logging: {
    compressedSizes?: boolean;
    buildSuccess?: boolean;
  };

  // Routing
  baseURL: string;
  apiBaseURL: string;

  serverEntry: false | { handler: string; format?: EventHandlerFormat };
  handlers: NitroEventHandler[];
  devHandlers: NitroDevEventHandler[];
  routeRules: { [path: string]: NitroRouteRules };
  routes: Record<string, string | Omit<NitroEventHandler, "route" | "middleware">>;

  errorHandler: string | string[];
  devErrorHandler: NitroErrorHandler;

  prerender: {
    /**
     * Prerender HTML routes within subfolders (`/test` would produce `/test/index.html`)
     */
    autoSubfolderIndex?: boolean;
    concurrency?: number;
    interval?: number;
    crawlLinks?: boolean;
    failOnError?: boolean;
    ignore?: Array<string | RegExp | ((path: string) => undefined | null | boolean)>;
    ignoreUnprefixedPublicAssets?: boolean;
    routes?: string[];
    /**
     * Amount of retries. Pass Infinity to retry indefinitely.
     * @default 3
     */
    retry?: number;
    /**
     * Delay between each retry in ms.
     * @default 500
     */
    retryDelay?: number;
  };

  // Rollup
  builder?: "rollup" | "rolldown" | "vite";
  rollupConfig?: RollupConfig;
  rolldownConfig?: RolldownConfig;
  entry: string;
  unenv: UnenvPreset[];
  alias: Record<string, string>;
  minify: boolean;
  inlineDynamicImports: boolean;
  sourcemap: boolean;
  node: boolean;
  moduleSideEffects: string[];
  oxc?: OXCOptions;
  replace: Record<string, string | ((id: string) => string)>;
  commonJS?: RollupCommonJSOptions;
  exportConditions?: string[];
  noExternals?: boolean | (string | RegExp)[];
  traceDeps?: (string | RegExp)[];

  // Advanced
  typescript: {
    strict?: boolean;
    generateRuntimeConfigTypes?: boolean;
    generateTsConfig?: boolean;
    tsConfig?: Partial<TSConfig>;

    /**
     * Path of the generated types directory.
     *
     * Default is `node_modules/.nitro/types`
     */
    generatedTypesDir?: string;

    /**
     * Path of the generated `tsconfig.json` relative to `typescript.generatedTypesDir`
     *
     * Default is `tsconfig.json` (`node_modules/.nitro/types/tsconfig.json`)
     */
    tsconfigPath?: string;
  };
  hooks: NestedHooks<NitroHooks>;
  commands: {
    preview?: string;
    deploy?: string;
  };

  // Framework
  framework: NitroFrameworkInfo;

  // IIS
  iis?: {
    mergeConfig?: boolean;
    overrideConfig?: boolean;
  };
}

/**
 * Nitro input config (nitro.config)
 */
export interface NitroConfig
  extends
    Partial<
      Omit<
        NitroOptions,
        | "routeRules"
        | "rollupConfig"
        | "preset"
        | "compatibilityDate"
        | "unenv"
        | "serverDir"
        | "_config"
        | "_c12"
        | "serverEntry"
        | "renderer"
        | "output"
      >
    >,
    C12InputConfig<NitroConfig> {
  preset?: PresetNameInput;
  extends?: string | string[] | NitroPreset;
  routeRules?: { [path: string]: NitroRouteConfig };
  rollupConfig?: Partial<RollupConfig>;
  compatibilityDate?: CompatibilityDateSpec;
  unenv?: UnenvPreset | UnenvPreset[];
  serverDir?: boolean | "./" | "./server" | (string & {});
  serverEntry?: string | NitroOptions["serverEntry"];
  renderer?: false | NitroOptions["renderer"];
  output?: Partial<NitroOptions["output"]>;
}

// ------------------------------------------------------------
// Config Loader
// ------------------------------------------------------------

export interface LoadConfigOptions {
  watch?: boolean;
  c12?: WatchConfigOptions;
  compatibilityDate?: CompatibilityDateSpec;
  dotenv?: boolean | DotenvOptions;
}

// ------------------------------------------------------------
// Partial types
// ------------------------------------------------------------

// Public assets
export interface PublicAssetDir {
  baseURL?: string;
  fallthrough?: boolean;
  maxAge: number;
  dir: string;
  /**
   * Pass false to disable ignore patterns when scanning the directory, or
   * pass an array of glob patterns to ignore (which will override global
   * nitro.ignore patterns).
   */
  ignore?: false | string[];
}

// Public assets compression
export interface CompressOptions {
  gzip?: boolean;
  brotli?: boolean;
}

// Server assets
export interface ServerAssetDir {
  baseName: string;
  pattern?: string;
  dir: string;
  ignore?: string[];
}

// Storage mounts
type CustomDriverName = string & { _custom?: any };
export interface StorageMounts {
  [path: string]: {
    driver: BuiltinDriverName | CustomDriverName;
    [option: string]: any;
  };
}

// Database
export type DatabaseConnectionName = "default" | (string & {});
export type DatabaseConnectionConfig = {
  connector: ConnectorName;
  options?: {
    [key: string]: any;
  };
};
export type DatabaseConnectionConfigs = Record<DatabaseConnectionName, DatabaseConnectionConfig>;

// Runtime config

export interface NitroRuntimeConfigApp {
  [key: string]: any;
}

export interface NitroRuntimeConfig {
  nitro?: {
    envPrefix?: string;
    envExpansion?: boolean;
    routeRules?: {
      [path: string]: NitroRouteConfig;
    };
    openAPI?: NitroOpenAPIConfig;
  };
  [key: string]: any;
}
