import type { RollupCommonJSOptions } from "@rollup/plugin-commonjs";
import type {
  C12InputConfig,
  ConfigWatcher,
  DotenvOptions,
  ResolvedConfig,
} from "c12";
import type { WatchConfigOptions } from "c12";
import type { ChokidarOptions } from "chokidar";
import type { CompatibilityDateSpec, CompatibilityDates } from "compatx";
import type { LogLevel } from "consola";
import type { ConnectorName } from "db0";
import type { NestedHooks } from "hookable";
import type { ProxyServerOptions } from "httpxy";
import type {
  NitroRuntimeConfigApp as NitroTypesRuntimeConfigApp,
  NitroRuntimeConfig as NitroTypeskRuntimeConfig,
} from "nitropack";
import type {
  PresetName,
  PresetNameInput,
  PresetOptions,
} from "nitropack/presets";
import type { TSConfig } from "pkg-types";
import type { PluginVisualizerOptions } from "rollup-plugin-visualizer";
import type { Preset as UnenvPreset } from "unenv";
import type { UnimportPluginOptions } from "unimport/unplugin";
import type { BuiltinDriverName } from "unstorage";
import type { UnwasmPluginOptions } from "unwasm/plugin";
import type { DeepPartial } from "./_utils";
import type { DevServerOptions } from "./dev";
import type {
  NitroDevEventHandler,
  NitroErrorHandler,
  NitroEventHandler,
} from "./handler";
import type { NitroHooks } from "./hooks";
import type { NitroModuleInput } from "./module";
import type { NitroFrameworkInfo } from "./nitro";
import type { NitroOpenAPIConfig } from "./openapi";
export type { NitroOpenAPIConfig } from "./openapi";
import type { NitroPreset } from "./preset";
import type { EsbuildOptions, NodeExternalsOptions } from "./rollup";
import type { RollupConfig } from "./rollup";
import type { NitroRouteConfig, NitroRouteRules } from "./route-rules";

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
  appConfig: AppConfig;
  appConfigFiles: string[];

  // Dirs
  workspaceDir: string;
  rootDir: string;
  srcDir: string;
  scanDirs: string[];
  apiDir: string;
  routesDir: string;
  buildDir: string;
  output: {
    dir: string;
    serverDir: string;
    publicDir: string;
  };

  // Features
  storage: StorageMounts;
  devStorage: StorageMounts;
  database: DatabaseConnectionConfigs;
  devDatabase: DatabaseConnectionConfigs;
  bundledStorage: string[];
  timing: boolean;
  renderer?: string;
  ssrRoutes: string[];
  serveStatic: boolean | "node" | "deno" | "inline";
  noPublicDir: boolean;

  /**
   * @experimental Requires `experimental.wasm` to work
   *
   * @see https://github.com/unjs/unwasm
   */
  wasm?: UnwasmPluginOptions;
  openAPI?: NitroOpenAPIConfig;
  experimental: {
    legacyExternals?: boolean;
    openAPI?: boolean;
    /**
     * See https://github.com/microsoft/TypeScript/pull/51669
     */
    typescriptBundlerResolution?: boolean;
    /**
     * Enable native async context support for useEvent()
     */
    asyncContext?: boolean;
    /**
     * Enable Experimental WebAssembly Support
     *
     * @see https://github.com/unjs/unwasm
     */
    wasm?: boolean;
    /**
     * Disable Experimental bundling of Nitro Runtime Dependencies
     */
    bundleRuntimeDependencies?: false;
    /**
     * Disable Experimental Sourcemap Minification
     */
    sourcemapMinify?: false;
    /**
     * Backward compatibility support for Node fetch (required for Node < 18)
     */
    nodeFetchCompat?: boolean;
    /**
     * Allow env expansion in runtime config
     *
     * @see https://github.com/nitrojs/nitro/pull/2043
     */
    envExpansion?: boolean;
    /**
     * Enable experimental WebSocket support
     *
     * @see https://nitro.build/guide/websocket
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
  };
  future: {
    nativeSWR: boolean;
  };
  serverAssets: ServerAssetDir[];
  publicAssets: PublicAssetDir[];

  imports: UnimportPluginOptions | false;
  modules?: NitroModuleInput[];
  plugins: string[];
  tasks: { [name: string]: { handler: string; description: string } };
  scheduledTasks: { [cron: string]: string | string[] };
  virtual: Record<string, string | (() => string | Promise<string>)>;
  compressPublicAssets: boolean | CompressOptions;
  ignore: string[];

  // Dev
  dev: boolean;
  devServer: DevServerOptions;
  watchOptions: ChokidarOptions;
  devProxy: Record<string, string | ProxyServerOptions>;

  // Logging
  logging: {
    compressedSizes: boolean;
    buildSuccess: boolean;
  };

  // Routing
  baseURL: string;
  apiBaseURL: string;
  handlers: NitroEventHandler[];
  routeRules: { [path: string]: NitroRouteRules };
  devHandlers: NitroDevEventHandler[];
  errorHandler: string | string[];
  devErrorHandler: NitroErrorHandler;
  prerender: {
    /**
     * Prerender HTML routes within subfolders (`/test` would produce `/test/index.html`)
     */
    autoSubfolderIndex: boolean;
    concurrency: number;
    interval: number;
    crawlLinks: boolean;
    failOnError: boolean;
    ignore: Array<
      string | RegExp | ((path: string) => undefined | null | boolean)
    >;
    ignoreUnprefixedPublicAssets: boolean;
    routes: string[];
    /**
     * Amount of retries. Pass Infinity to retry indefinitely.
     * @default 3
     */
    retry: number;
    /**
     * Delay between each retry in ms.
     * @default 500
     */
    retryDelay: number;
  };

  // Rollup
  rollupConfig?: RollupConfig;
  entry: string;
  unenv: UnenvPreset[];
  alias: Record<string, string>;
  minify: boolean;
  inlineDynamicImports: boolean;
  sourceMap: boolean | "inline" | "hidden";
  node: boolean;
  moduleSideEffects: string[];
  esbuild?: {
    options?: Partial<EsbuildOptions>;
  };
  noExternals: boolean;
  externals: NodeExternalsOptions;
  analyze: false | PluginVisualizerOptions;
  replace: Record<string, string | ((id: string) => string)>;
  commonJS?: RollupCommonJSOptions;
  exportConditions?: string[];

  // Advanced
  typescript: {
    strict?: boolean;
    internalPaths?: boolean;
    generateRuntimeConfigTypes?: boolean;
    generateTsConfig?: boolean;
    /** the path of the generated `tsconfig.json`, relative to buildDir */
    tsconfigPath: string;
    tsConfig?: Partial<TSConfig>;
  };
  hooks: NestedHooks<NitroHooks>;
  nodeModulesDirs: string[];
  commands: {
    preview: string;
    deploy: string;
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
  extends DeepPartial<
      Omit<
        NitroOptions,
        "routeRules" | "rollupConfig" | "preset" | "compatibilityDate" | "unenv"
      >
    >,
    C12InputConfig<NitroConfig> {
  preset?: PresetNameInput;
  extends?: string | string[] | NitroPreset;
  routeRules?: { [path: string]: NitroRouteConfig };
  rollupConfig?: Partial<RollupConfig>;
  compatibilityDate?: CompatibilityDateSpec;
  unenv?: UnenvPreset | UnenvPreset[];
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

// App config
export interface AppConfig {
  [key: string]: any;
}

// Public assets
export interface PublicAssetDir {
  baseURL?: string;
  fallthrough?: boolean;
  maxAge: number;
  dir: string;
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
export type DatabaseConnectionConfigs = Record<
  DatabaseConnectionName,
  DatabaseConnectionConfig
>;

// Runtime config

export interface NitroRuntimeConfigApp extends NitroTypesRuntimeConfigApp {}

export interface NitroRuntimeConfig extends NitroTypeskRuntimeConfig {}
