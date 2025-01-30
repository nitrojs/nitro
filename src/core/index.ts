import type { AppOptions, H3Event } from "h3";
import type {
  CaptureError,
  NitroConfig,
  NitroOpenAPIConfig,
  NitroRouteConfig,
  RenderResponse,
  RenderContext,
} from "nitropack/types";

// Core
export { createNitro } from "./nitro";

// Prerender
export { prerender } from "./prerender/prerender";

// Dev server
export { createDevServer } from "./dev-server/server";

// Config loader
export { loadOptions } from "./config/loader";

// Tasks API
export { runTask, listTasks } from "./task";

// Build
export { build } from "./build/build";
export { copyPublicAssets } from "./build/assets";
export { prepare } from "./build/prepare";
export { writeTypes } from "./build/types";

// ----------- Backward compatibility -----------

/**
 * @deprecated Please import `defineNitroConfig` from nitropack/config instead
 */
export function defineNitroConfig(config: NitroConfig): NitroConfig {
  return config;
}

/** @deprecated Please import `defineNitroPreset` from nitropack/kit instead */
export { defineNitroPreset } from "nitropack/kit";

/** @deprecated Avoid depending on GLOB_SCAN_PATTERN  */
export { GLOB_SCAN_PATTERN } from "./scan";

/** @deprecated Directly import { runtimeDependencies } from "nitropack/runtime/meta"; */
export { runtimeDependencies as nitroRuntimeDependencies } from "nitropack/runtime/meta";

/** @deprecated Avoid depending on scan utils */
export {
  scanHandlers,
  scanMiddleware,
  scanModules,
  scanPlugins,
  scanServerRoutes,
  scanTasks,
} from "./scan";

/** @deprecated Use `NitroRuntimeConfig` from `nitropack/types` */
export interface NitroRuntimeConfig {
  app: NitroRuntimeConfigApp;
  nitro: {
    envPrefix?: string;
    envExpansion?: boolean;
    routeRules?: {
      [path: string]: NitroRouteConfig;
    };
    openAPI?: NitroOpenAPIConfig;
  };
  [key: string]: any;
}

/** @deprecated Use `NitroRuntimeHooks` from `nitropack/types` */
export interface NitroRuntimeHooks {
  close: () => void;
  error: CaptureError;

  request: NonNullable<AppOptions["onRequest"]>;
  beforeResponse: NonNullable<AppOptions["onBeforeResponse"]>;
  afterResponse: NonNullable<AppOptions["onAfterResponse"]>;

  "render:before": (context: RenderContext) => void;

  "render:response": (
    response: Partial<RenderResponse>,
    context: RenderContext
  ) => void;
}

/** @deprecated Use `NitroRuntimeConfigApp` from `nitropack/types` */
export interface NitroRuntimeConfigApp {
  baseURL: string;
  [key: string]: any;
}

/** @deprecated Directly import { ... } from "nitropack/types"; */
export type {
  LoadConfigOptions,
  Nitro,
  NitroConfig,
  NitroDevServer,
  NitroOptions,
  NitroPreset,
  NitroWorker,
  Serialize,
  SerializeObject,
  SerializeTuple,
  Simplify,
  $Fetch,
  AppConfig,
  AvailableRouterMethod,
  CompressOptions,
  DatabaseConnectionConfig,
  DatabaseConnectionConfigs,
  DatabaseConnectionName,
  DevServerOptions,
  ExtractedRouteMethod,
  H3Event$Fetch,
  H3EventFetch,
  InternalApi,
  MatchedRoutes,
  MiddlewareOf,
  NitroBuildInfo,
  NitroDevEventHandler,
  NitroDynamicConfig,
  NitroErrorHandler,
  NitroEventHandler,
  NitroFetchOptions,
  NitroFetchRequest,
  NitroFrameworkInfo,
  NitroHooks,
  NitroModule,
  NitroModuleInput,
  NitroRouteConfig,
  NitroRouteRules,
  // NitroRuntimeConfig,
  // NitroRuntimeConfigApp,
  NitroStaticBuildFlags,
  NitroTypes,
  PrerenderGenerateRoute,
  PrerenderRoute,
  PublicAssetDir,
  ServerAssetDir,
  StorageMounts,
  TypedInternalResponse,
  // KebabCase,
  // Runtime
  RenderResponse,
  RenderHandler,
  TaskContext,
  TaskPayload,
  TaskMeta,
  TaskEvent,
  TaskResult,
  Task,
  NitroAppPlugin,
  CacheEntry,
  CacheOptions,
  ResponseCacheEntry,
  CachedEventHandlerOptions,
  NitroApp,
} from "nitropack/types";
