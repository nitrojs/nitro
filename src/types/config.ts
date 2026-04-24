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
import type { ExternalsTraceOptions } from "nf3";
import type { UnwasmPluginOptions } from "unwasm/plugin";
import type { RunnerName } from "env-runner";
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
 * Fully resolved Nitro options available on `nitro.options`.
 *
 * These are the normalized options after preset defaults and user config
 * have been merged. For the user-facing input type, see {@link NitroConfig}.
 *
 * @see https://nitro.build/config
 */
export interface NitroOptions extends PresetOptions {
  // Internal
  _config: NitroConfig;
  _c12: ResolvedConfig<NitroConfig> | ConfigWatcher<NitroConfig>;
  _cli?: {
    command?: string;
  };

  // General

  /**
   * Opt-in date for deployment provider and runtime compatibility features.
   *
   * Providers introduce new features that Nitro presets can leverage, but
   * some need to be explicitly opted into. Set to the latest tested date
   * in `YYYY-MM-DD` format.
   *
   * @default "latest"
   * @see https://nitro.build/config#compatibilitydate
   */
  compatibilityDate: CompatibilityDates;

  /**
   * Enables debugging nitro (build time) hooks in the console.
   *
   * @see https://nitro.build/config#debug
   */
  debug: boolean;

  /**
   * Deployment preset name.
   *
   * Determines how the production bundle is built and optimized for a
   * specific hosting provider or runtime. Auto-detected in known
   * environments when not set. Use the `NITRO_PRESET` environment
   * variable as an alternative.
   *
   * @see https://nitro.build/config#preset
   */
  preset: PresetName;

  /**
   * Disable the server build and only output prerendered static assets.
   *
   * When `true`, the server bundle is skipped entirely and only the public directory is produced.
   * Typically used by the `static` preset and its derivatives (e.g., `github-pages`, `vercel-static`).
   *
   * Note: This does not enable prerendering on its own — configure `prerender` options separately.
   *
   * @see https://nitro.build/config#static
   */
  static: boolean;

  /**
   * Log verbosity level.
   *
   * Defaults to `3`, or `1` when a testing environment is detected.
   *
   * @see https://nitro.build/config#loglevel
   * @see https://github.com/unjs/consola
   */
  logLevel: LogLevel;

  /**
   * Server runtime configuration accessible via `useRuntimeConfig()`.
   *
   * Values can be overridden at runtime using environment variables with
   * the `NITRO_` prefix. An alternative prefix can be configured via
   * `runtimeConfig.nitro.envPrefix` or `NITRO_ENV_PREFIX`.
   *
   * **Note:** The `nitro` namespace is reserved for internal use.
   *
   * @example
   * ```ts
   * runtimeConfig: {
   *   apiSecret: "default-secret", // override with NITRO_API_SECRET
   * }
   * ```
   *
   * @see https://nitro.build/config#runtimeconfig
   */
  runtimeConfig: NitroRuntimeConfig;

  // Dirs

  /**
   * Project workspace root directory.
   *
   * Auto-detected from the workspace (e.g. pnpm workspace) when not set.
   *
   * @see https://nitro.build/config#workspacedir
   */
  workspaceDir: string;

  /**
   * Project main root directory.
   *
   * @see https://nitro.build/config#rootdir
   */
  rootDir: string;

  /**
   * Server directory for scanning `api/`, `routes/`, `plugins/`, `utils/`,
   * `middleware/`, `modules/`, and `tasks/` folders.
   *
   * Set to `false` to disable automatic directory scanning, `"./"` to use
   * the root directory, or `"./server"` to use a `server/` subdirectory.
   *
   * @default false
   * @see https://nitro.build/config#serverdir
   */
  serverDir: string | false;

  /**
   * Additional directories to scan and auto-register files such as API
   * route handlers.
   *
   * @see https://nitro.build/config#scandirs
   */
  scanDirs: string[];

  /**
   * Directory name to scan for API route handlers.
   *
   * @default "api"
   * @see https://nitro.build/config#apidir
   */
  apiDir: string;

  /**
   * Directory name to scan for route handlers.
   *
   * @default "routes"
   * @see https://nitro.build/config#routesdir
   */
  routesDir: string;

  /**
   * Nitro's temporary working directory for build-related files.
   *
   * @default "node_modules/.nitro"
   * @see https://nitro.build/config#builddir
   */
  buildDir: string;

  /**
   * Output directories for the production bundle.
   *
   * @see https://nitro.build/config#output
   */
  output: {
    /** Production output root directory. */
    dir: string;
    /** Server bundle output directory. */
    serverDir: string;
    /** Public/static assets output directory. */
    publicDir: string;
  };

  /** @deprecated Migrate to `serverDir`. */
  srcDir: string;

  // Features

  /**
   * Storage mount configuration.
   *
   * Keys are mount-point paths; values specify the unstorage driver and
   * its options.
   *
   * @see https://nitro.build/config#storage
   * @see https://nitro.build/docs/storage
   */
  storage: StorageMounts;

  /**
   * Storage mount overrides for development mode.
   *
   * Useful for swapping production drivers (e.g. Redis) with local
   * alternatives (e.g. filesystem) during development.
   *
   * @see https://nitro.build/config#devstorage
   * @see https://nitro.build/docs/storage
   */
  devStorage: StorageMounts;

  /**
   * Database connection configurations.
   *
   * Requires `experimental.database: true`.
   *
   * @see https://nitro.build/config#database
   * @see https://nitro.build/docs/database
   */
  database: DatabaseConnectionConfigs;

  /**
   * Database connection overrides for development mode.
   *
   * @see https://nitro.build/config#devdatabase
   * @see https://nitro.build/docs/database
   */
  devDatabase: DatabaseConnectionConfigs;

  /**
   * Server-side rendering entry configuration.
   *
   * Points to the main render handler (the file should export an event
   * handler as default). Set to `false` to disable.
   *
   * @see https://nitro.build/config#renderer
   * @see https://nitro.build/docs/renderer
   */
  renderer?: { handler?: string; static?: boolean; template?: string };

  /**
   * Routes that should be server-side rendered.
   */
  ssrRoutes: string[];

  /**
   * Include a static asset handler in the server bundle to serve public assets.
   *
   * - `true` or `"node"` — read assets from the filesystem using Node.js `fs`.
   * - `"deno"` — read assets using Deno file APIs.
   * - `"inline"` — base64-encode assets directly into the server bundle.
   * - `false` — do not serve static assets from the server (rely on a CDN or reverse proxy).
   *
   * Most self-hosted presets (e.g. `node-server`, `bun`) enable this by default.
   *
   * @see https://nitro.build/config#servestatic
   */
  serveStatic: boolean | "node" | "deno" | "inline";

  /**
   * Disable the public output directory entirely.
   *
   * Skips preparing the `.output/public` directory, copying public
   * assets, and prerendering routes.
   *
   * @see https://nitro.build/config#nopublicdir
   */
  noPublicDir: boolean;
  tracingChannel?: undefined | TracingOptions;

  /**
   * Build manifest options.
   */ manifest?: {
    /** Custom deployment identifier included in the build manifest. */
    deploymentId?: string;
  };

  /**
   * Built-in feature flags.
   *
   * @see https://nitro.build/config#features
   */
  features: {
    /**
     * Enable runtime hooks for request and response.
     *
     * By default this feature will be enabled if there is at least one nitro plugin.
     */
    runtimeHooks?: boolean;

    /**
     * Enable WebSocket support.
     */
    websocket?: boolean;
  };

  /**
   * Native wasm compatibility/bundling support configuration.
   *
   * Set to `false` to disable.
   *
   * @see https://nitro.build/config#wasm
   * @see https://github.com/unjs/unwasm
   */
  wasm?: false | UnwasmPluginOptions;

  /**
   * OpenAPI specification generation and UI configuration.
   *
   * @see https://nitro.build/config#openapi
   * @see https://nitro.build/docs/openapi
   */
  openAPI?: NitroOpenAPIConfig;

  /**
   * Experimental feature flags.
   *
   * These features are not yet stable and may change in future releases.
   *
   * @see https://nitro.build/config#experimental
   */
  experimental: {
    /**
     * Enable experimental OpenAPI support
     *
     * @see https://nitro.build/docs/openapi
     */
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
     * Set to `false` to disable sourcemap minification in production builds.
     *
     * Sourcemap minification is enabled by default when `sourcemap` is on.
     */
    sourcemapMinify?: false;
    /**
     * Allow env expansion in runtime config
     *
     * @see https://github.com/nitrojs/nitro/pull/2043
     */
    envExpansion?: boolean;
    /**
     * Enable WebSocket upgrade support
     *
     * @deprecated Use `features.websocket` instead.
     */
    websocket?: boolean;
    /**
     * Enable experimental Database support
     *
     * @see https://nitro.build/docs/database
     */
    database?: boolean;
    /**
     * Enable experimental Tasks support
     *
     * @see https://nitro.build/docs/tasks
     */
    tasks?: boolean;
  };

  /**
   * Future features pending a major version to avoid breaking changes.
   *
   * @see https://nitro.build/config#future
   */
  future: {
    /** Opt in to Nitro's native `isr` route rule handling on Vercel and suppress backwards-compatibility warnings for legacy `swr`/`static` route options. */
    nativeSWR?: boolean;
  };

  /**
   * Server-side asset directories bundled at build time.
   *
   * @see https://nitro.build/config#serverassets
   * @see https://nitro.build/docs/assets#server-assets
   */
  serverAssets: ServerAssetDir[];

  /**
   * Public asset directories served in development and bundled in production.
   *
   * A `public/` directory is added by default when detected.
   *
   * @see https://nitro.build/config#publicassets
   * @see https://nitro.build/docs/assets
   */
  publicAssets: PublicAssetDir[];

  /**
   * Auto-import configuration.
   *
   * Set to `false` to disable auto-imports. Pass an object to customize.
   *
   * @default false
   * @see https://nitro.build/config#imports
   * @see https://github.com/unjs/unimport
   */
  imports: Partial<UnimportPluginOptions> | false;

  /**
   * Nitro modules to extend behavior during initialization.
   *
   * Accepts module path strings, {@link NitroModule} objects, or bare setup functions.
   *
   * @see https://nitro.build/config#modules
   */
  modules?: NitroModuleInput[];

  /**
   * Paths to Nitro runtime plugins.
   *
   * Plugins in the `plugins/` directory are auto-registered.
   *
   * @see https://nitro.build/config#plugins
   * @see https://nitro.build/docs/plugins
   */
  plugins: string[];

  /**
   * Task definitions.
   *
   * Each key is a task name with a `handler` path and optional `description`.
   *
   * @example
   * ```ts
   * tasks: {
   *   "db:migrate": {
   *     handler: "./tasks/db-migrate",
   *     description: "Run database migrations",
   *   },
   * }
   * ```
   *
   * @see https://nitro.build/config#tasks
   * @see https://nitro.build/docs/tasks
   */
  tasks: { [name: string]: { handler?: string; description?: string } };

  /**
   * Map of cron expressions to task name(s).
   *
   * @example
   * ```ts
   * scheduledTasks: {
   *   "0 * * * *": "cleanup:temp",
   *   "*​/5 * * * *": ["health:check", "metrics:collect"],
   * }
   * ```
   *
   * @see https://nitro.build/config#scheduledtasks
   * @see https://nitro.build/docs/tasks
   */
  scheduledTasks: { [cron: string]: string | string[] };

  /**
   * Virtual module definitions.
   *
   * A map from dynamic virtual import names to their contents or an async
   * function that returns them.
   *
   * @see https://nitro.build/config#virtual
   */
  virtual: Record<string, string | (() => string | Promise<string>)>;

  /**
   * Pre-compress public assets and prerendered routes.
   *
   * Generates gzip and brotli (and zstd when available)
   * variants of compressible assets larger than 1024 bytes. Pass an
   * object to selectively enable/disable each encoding.
   *
   * @see https://nitro.build/config#compresspublicassets
   */
  compressPublicAssets: boolean | CompressOptions;

  /**
   * Glob patterns to ignore when scanning directories.
   *
   * @see https://nitro.build/config#ignore
   */
  ignore: string[];

  // Dev

  /**
   * Whether the current build targets development mode.
   *
   * Defaults to `true` during development and `false` for production.
   *
   * @see https://nitro.build/config#dev
   */
  dev: boolean;

  /**
   * Development server options.
   *
   * @see https://nitro.build/config#devserver
   */
  devServer: {
    /** Port number for the dev server. */
    port?: number;
    /** Hostname for the dev server. */
    hostname?: string;
    /** Additional paths to watch for dev server reloads. */
    watch?: string[];
    /** Runtime runner to use for the dev server. */
    runner?: RunnerName;
  };

  /**
   * File watcher options for development mode.
   *
   * @see https://nitro.build/config#watchoptions
   * @see https://github.com/paulmillr/chokidar
   */
  watchOptions: ChokidarOptions;

  /**
   * Proxy configuration for the development server.
   *
   * A map of path prefixes to proxy target URLs or options.
   *
   * @example
   * ```ts
   * devProxy: {
   *   "/proxy/test": "http://localhost:3001",
   *   "/proxy/example": { target: "https://example.com", changeOrigin: true },
   * }
   * ```
   *
   * @see https://nitro.build/config#devproxy
   * @see https://github.com/unjs/httpxy
   */
  devProxy: Record<string, string | ProxyServerOptions>;

  // Logging

  /**
   * Build logging behavior.
   *
   * @see https://nitro.build/config#logging
   */
  logging: {
    /** Report compressed bundle sizes after build. */
    compressedSizes?: boolean;
    /** Show the build success message. */
    buildSuccess?: boolean;
  };

  // Routing

  /**
   * Server's main base URL prefix.
   *
   * Can also be set via the `NITRO_APP_BASE_URL` environment variable.
   *
   * @default "/"
   * @see https://nitro.build/config#baseurl
   */
  baseURL: string;

  /**
   * Base URL prefix for API routes.
   *
   * @default "/api"
   * @see https://nitro.build/config#apibaseurl
   */
  apiBaseURL: string;

  /**
   * Custom server entry point configuration.
   *
   * Set to `false` to disable the default server entry.
   *
   * @see https://nitro.build/docs/server-entry
   */
  serverEntry: false | { handler: string; format?: EventHandlerFormat };

  /**
   * Server handler registrations.
   *
   * Handlers in `routes/`, `api/`, and `middleware/` directories are
   * auto-registered when {@link NitroOptions.serverDir | serverDir} is set.
   *
   * @see https://nitro.build/config#handlers
   * @see https://nitro.build/docs/routing
   */
  handlers: NitroEventHandler[];

  /**
   * Development-only event handlers with inline handler functions.
   *
   * Not included in production builds.
   *
   * @see https://nitro.build/config#devhandlers
   */
  devHandlers: NitroDevEventHandler[];

  /**
   * Route rules applied to matching request paths.
   *
   * Supports caching, redirects, proxying, headers, CORS, and more.
   * Rules are matched using rou3 patterns and deep-merged when multiple
   * patterns match.
   *
   * @see https://nitro.build/config#routerules
   * @see https://nitro.build/docs/routing#route-rules
   */
  routeRules: { [path: string]: NitroRouteRules };

  /**
   * Inline route definitions.
   *
   * A map from route pattern to handler path or handler options.
   *
   * @see https://nitro.build/config#routes
   */
  routes: Record<string, string | Omit<NitroEventHandler, "route" | "middleware">>;

  /**
   * Path(s) to custom runtime error handler(s).
   *
   * Custom handlers run before the built-in error handler, which is
   * always added as a fallback.
   *
   * @see https://nitro.build/config#errorhandler
   */
  errorHandler: string | string[];

  /**
   * Custom error handler function for development mode.
   *
   * @see https://nitro.build/config#deverrorhandler
   */
  devErrorHandler: NitroErrorHandler;

  /**
   * Prerendering options.
   *
   * Routes specified here are fetched during the build and copied to
   * `.output/public` as static assets.
   *
   * @see https://nitro.build/config#prerender
   */
  prerender: {
    /**
     * Prerender HTML routes within subfolders (`/test` produces `/test/index.html`).
     */
    autoSubfolderIndex?: boolean;
    /** Maximum number of concurrent prerender requests. */
    concurrency?: number;
    /** Delay in milliseconds between prerender requests. */
    interval?: number;
    /** Crawl `<a>` tags in prerendered HTML to discover additional routes. */
    crawlLinks?: boolean;
    /** Fail the build when a route cannot be prerendered. */
    failOnError?: boolean;
    /** Patterns (string, RegExp, or function) of routes to skip. */
    ignore?: Array<string | RegExp | ((path: string) => undefined | null | boolean)>;
    /** Skip prerendering assets without a base URL prefix. */
    ignoreUnprefixedPublicAssets?: boolean;
    /** Explicit list of routes to prerender. */
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

  // Build

  /**
   * Bundler to use for production builds.
   *
   * Auto-detected when not set: `"vite"` if a `vite.config` with the
   * `nitro()` plugin is found, otherwise `"rolldown"` (bundled with Nitro).
   * Use the `NITRO_BUILDER` environment variable as an alternative.
   *
   * @see https://nitro.build/config#builder
   */
  builder?: "rollup" | "rolldown" | "vite";

  /**
   * Additional Rollup configuration.
   *
   * @see https://nitro.build/config#rollupconfig
   */
  rollupConfig?: RollupConfig;

  /**
   * Additional Rolldown configuration.
   *
   * @see https://nitro.build/config#rolldownconfig
   */
  rolldownConfig?: RolldownConfig;

  /**
   * Bundler entry point path.
   *
   * @see https://nitro.build/config#entry
   */
  entry: string;

  /**
   * unenv preset(s) for environment compatibility polyfills.
   *
   * @see https://nitro.build/config#unenv
   * @see https://github.com/unjs/unenv
   */
  unenv: UnenvPreset[];

  /**
   * Path aliases for module resolution.
   *
   * @example
   * ```ts
   * alias: {
   *   "~utils": "./src/utils",
   *   "#shared": "./shared",
   * }
   * ```
   *
   * @see https://nitro.build/config#alias
   */
  alias: Record<string, string>;

  /**
   * Minify the production bundle.
   *
   * @see https://nitro.build/config#minify
   */
  minify: boolean;

  /**
   * Bundle all code into a single file instead of separate chunks.
   *
   * When `false`, each route handler becomes a separate chunk loaded
   * on-demand. Some presets enable this by default.
   *
   * @see https://nitro.build/config#inlinedynamicimports
   */
  inlineDynamicImports: boolean;

  /**
   * Enable source map generation.
   *
   * @see https://nitro.build/config#sourcemap
   */
  sourcemap: boolean;

  /**
   * Target a Node.js-compatible runtime.
   *
   * When `true` (default), the bundler targets the `node` platform, prefers
   * Node.js built-in modules, and enables dependency externalization.
   *
   * When `false`, Nitro prepends the `nodeless` unenv preset to polyfill
   * Node.js globals and built-ins for non-Node runtimes (workers, edge, Deno).
   *
   * @see https://nitro.build/config#node
   */
  node: boolean;

  /**
   * OXC options for Rolldown builds (minification and transforms).
   *
   * @see https://nitro.build/config#oxc
   */
  oxc?: OXCOptions;

  /**
   * Build-time string replacements.
   *
   * @see https://nitro.build/config#replace
   */
  replace: Record<string, string | ((id: string) => string)>;

  /**
   * Additional configuration for the Rollup CommonJS plugin.
   *
   * @see https://nitro.build/config#commonjs
   */
  commonJS?: RollupCommonJSOptions;

  /**
   * Custom export conditions for module resolution.
   *
   * @see https://nitro.build/config#exportconditions
   */
  exportConditions?: string[];

  /**
   * Prevent packages from being externalized.
   *
   * Set to `true` to bundle all dependencies, or pass an array of
   * package names or patterns.
   *
   * @see https://nitro.build/config#noexternals
   */
  noExternals?: boolean | (string | RegExp)[];

  /**
   * Additional dependencies to trace and include in the build output.
   *
   * Supports `!pkg` to exclude and `pkg*` for full package trace.
   *
   * @see https://nitro.build/config#tracedeps
   */
  traceDeps?: (string | RegExp)[];

  /**
   * Advanced options for dependency tracing via nf3.
   *
   * @see https://nitro.build/config#traceopts
   * @see https://github.com/nicolo-ribaudo/nf3
   */
  traceOpts?: Pick<ExternalsTraceOptions, "nft" | "traceAlias" | "chmod" | "transform" | "hooks">;

  // Advanced

  /**
   * TypeScript configuration options.
   *
   * @see https://nitro.build/config#typescript
   */
  typescript: {
    /** Enable strict TypeScript checks. */
    strict?: boolean;
    /** Generate types for runtime config. */
    generateRuntimeConfigTypes?: boolean;
    /** Generate a `tsconfig.json` in the build directory. */
    generateTsConfig?: boolean;
    /** Custom tsconfig overrides. */
    tsConfig?: Partial<TSConfig>;

    /**
     * Path of the generated types directory.
     *
     * @default "node_modules/.nitro/types"
     */
    generatedTypesDir?: string;

    /**
     * Path of the generated `tsconfig.json` relative to `typescript.generatedTypesDir`.
     *
     * @default "tsconfig.json"
     */
    tsconfigPath?: string;
  };

  /**
   * Nitro lifecycle hooks.
   *
   * @see https://nitro.build/config#hooks
   * @see https://nitro.build/docs/lifecycle
   * @see https://github.com/unjs/hookable
   */
  hooks: NestedHooks<NitroHooks>;

  /**
   * Preview and deploy command hints (usually filled by deployment presets).
   *
   * @see https://nitro.build/config#commands
   */
  commands: {
    /** Command to preview the production build locally. */
    preview?: string;
    /** Command to deploy the production build. */
    deploy?: string;
  };

  /**
   * Metadata about the higher-level framework using Nitro (e.g. Nuxt).
   *
   * Used by presets and included in build info output.
   *
   * @see https://nitro.build/config#framework
   */
  framework: NitroFrameworkInfo;

  /**
   * IIS-specific deployment options.
   */
  iis?: {
    /** Merge with existing IIS `web.config` instead of replacing. */
    mergeConfig?: boolean;
    /** Override existing IIS `web.config` entirely. */
    overrideConfig?: boolean;
  };
}

/**
 * User-facing Nitro configuration used in `nitro.config.ts` or
 * `defineNitroConfig()`.
 *
 * All properties are optional and will be merged with defaults and preset
 * values to produce the fully resolved {@link NitroOptions}.
 *
 * @see https://nitro.build/config
 * @see https://nitro.build/docs/configuration
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
        | "tracingChannel"
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
  tracingChannel?: boolean | TracingOptions;
}

// ------------------------------------------------------------
// Config Loader
// ------------------------------------------------------------

/** Options for loading Nitro configuration via c12. */
export interface LoadConfigOptions {
  watch?: boolean;
  c12?: WatchConfigOptions;
  compatibilityDate?: CompatibilityDateSpec;
  dotenv?: boolean | DotenvOptions;
}

// ------------------------------------------------------------
// Partial types
// ------------------------------------------------------------

/**
 * Configuration for a public asset directory served in development and
 * bundled in production.
 *
 * @see https://nitro.build/config#publicassets
 * @see https://nitro.build/docs/assets
 */
export interface PublicAssetDir {
  /** URL prefix under which these assets are served. */
  baseURL?: string;
  /** Fall through to the next handler when the asset is not found. */
  fallthrough?: boolean;
  /** `Cache-Control` max-age value in seconds. */
  maxAge: number;
  /** Filesystem path to the asset directory. */
  dir: string;
  /**
   * Pass `false` to disable ignore patterns when scanning the directory,
   * or pass an array of glob patterns to ignore (overrides global
   * `nitro.ignore` patterns).
   */
  ignore?: false | string[];
}

/**
 * Pre-compression options for public assets and prerendered routes.
 *
 * @see https://nitro.build/config#compresspublicassets
 */
export interface CompressOptions {
  /** Enable gzip pre-compression. */
  gzip?: boolean;
  /** Enable brotli pre-compression. */
  brotli?: boolean;
  /** Enable zstd pre-compression. */
  zstd?: boolean;
}

/**
 * Configuration for a server-side asset directory bundled at build time.
 *
 * @see https://nitro.build/config#serverassets
 * @see https://nitro.build/docs/assets#server-assets
 */
export interface ServerAssetDir {
  /** Logical name used to access the asset group at runtime. */
  baseName: string;
  /** Glob pattern to filter files within the directory. */
  pattern?: string;
  /** Filesystem path to the asset directory. */
  dir: string;
  /** Glob patterns to ignore when scanning the directory. */
  ignore?: string[];
}

export interface TracingOptions {
  srvx?: boolean;
  h3?: boolean;
}

/**
 * Storage mount configuration mapping mount points to driver options.
 *
 * Keys are storage mount-point paths; values specify the unstorage driver
 * and its options.
 *
 * @see https://nitro.build/config#storage
 * @see https://nitro.build/docs/storage
 */
type CustomDriverName = string & { _custom?: any };
export interface StorageMounts {
  [path: string]: {
    driver: BuiltinDriverName | CustomDriverName;
    [option: string]: any;
  };
}

// Database

/** Logical database connection name. Defaults to `"default"`. */
export type DatabaseConnectionName = "default" | (string & {});

/**
 * Database connection configuration specifying a db0 connector and options.
 *
 * @see https://nitro.build/config#database
 * @see https://nitro.build/docs/database
 */
export type DatabaseConnectionConfig = {
  connector: ConnectorName;
  options?: {
    [key: string]: any;
  };
};

/** Map of {@link DatabaseConnectionName} to {@link DatabaseConnectionConfig}. */
export type DatabaseConnectionConfigs = Record<DatabaseConnectionName, DatabaseConnectionConfig>;

// Runtime config

/** Application-specific runtime configuration. */
export interface NitroRuntimeConfigApp {
  [key: string]: any;
}

/**
 * Server runtime configuration accessible via `useRuntimeConfig()`.
 *
 * Values can be overridden at runtime using environment variables with
 * the `NITRO_` prefix. An alternative prefix can be configured via
 * `nitro.envPrefix` or `NITRO_ENV_PREFIX`.
 *
 * @see https://nitro.build/config#runtimeconfig
 */
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
