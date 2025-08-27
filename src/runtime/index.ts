// Public API (also exposed as auto-imports defined in core/imports.ts)

// App
export { useNitroApp } from "./internal/app";

// Config
export { useRuntimeConfig, useAppConfig } from "./internal/config";

// Storage
export { useStorage } from "./internal/storage";

// Type (only) helpers
export { defineNitroPlugin } from "./internal/plugin";
export { defineRouteMeta } from "./internal/meta";
export { defineNitroErrorHandler } from "./internal/error/utils";

// Renderer
export { defineRenderHandler } from "./internal/renderer";

// Route rules
export { getRouteRules } from "./internal/route-rules";

// Context
export { useEvent } from "./internal/context";

// Tasks
export { defineTask, runTask } from "./internal/task";

// Database
export { useDatabase } from "./internal/database";

// Cache
export {
  defineCachedFunction,
  defineCachedEventHandler,
  cachedFunction,
  cachedEventHandler,
} from "./internal/cache";
