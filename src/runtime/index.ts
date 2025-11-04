// Public API (also exposed as auto-imports defined in core/imports.ts)

// Type (only) helpers
export { defineNitroPlugin } from "./internal/plugin.ts";
export { defineRouteMeta } from "./internal/meta.ts";
export { defineNitroErrorHandler } from "./internal/error/utils.ts";

// Config
export { useRuntimeConfig } from "./internal/runtime-config.ts";

// Context
export { useRequest } from "./internal/context.ts";

// Cache
export {
  defineCachedFunction,
  defineCachedEventHandler,
  defineCachedHandler,
  cachedFunction,
  cachedEventHandler,
} from "./internal/cache.ts";

// ---- Internals that depends on virtual imports should come last ---- //

// App
export {
  useNitroApp,
  useNitroHooks,
  serverFetch,
  fetch,
} from "./internal/app.ts";

// Storage
export { useStorage } from "./internal/storage.ts";

// Database
export { useDatabase } from "./internal/database.ts";

// Tasks
export { defineTask, runTask } from "./internal/task.ts";
