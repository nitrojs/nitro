// Backward compatibility for imports from "#internal/nitro/*" or "nitro/runtime/*"

export {
  cachedEventHandler,
  cachedFunction,
  defineCachedEventHandler,
  defineCachedFunction,
} from "./internal/cache";
