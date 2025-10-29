// Public API (also exposed as auto-imports defined in core/imports.ts)

// Type (only) helpers
export { defineNitroPlugin } from "./internal/plugin";
export { defineRouteMeta } from "./internal/meta";
export { defineNitroErrorHandler } from "./internal/error/utils";

// Config
export { useRuntimeConfig } from "./internal/runtime-config";

// Context
export { useRequest } from "./internal/context";

// Renderer
export { defineRenderHandler } from "./internal/renderer";

// Cache
export {
  defineCachedFunction,
  defineCachedEventHandler,
  defineCachedHandler,
  cachedFunction,
  cachedEventHandler,
} from "./internal/cache";

// ---- Internals that depends on virtual imports should come last ---- //

// App
export { useNitroApp, useNitroHooks } from "./internal/app";

// Storage
export { useStorage } from "./internal/storage";

// Database
export { useDatabase } from "./internal/database";

// Tasks
export { defineTask, runTask } from "./internal/task";
