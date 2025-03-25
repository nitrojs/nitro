// Limited INTERNAL exports used by the presets runtime
// Please don't use these in your project code!

export {
  trapUnhandledNodeErrors,
  normalizeCookieHeader,
  requestHasBody,
  joinHeaders,
  toBuffer,
} from "./utils";

export {
  normalizeLambdaIncomingHeaders,
  normalizeLambdaOutgoingHeaders,
  normalizeLambdaOutgoingBody,
} from "./utils.lambda";

export { startScheduleRunner, runCronTasks } from "./task";
export { getAzureParsedCookiesFromHeaders } from "./utils.azure";
export { getGracefulShutdownConfig, setupGracefulShutdown } from "./shutdown";
export { getRouteRulesForPath } from "./route-rules";

export { useNitroApp } from "./app";
export { useRuntimeConfig } from "./config";
export { defineNitroPlugin, nitroPlugin } from "./plugin";

export {
  defineCachedFunction,
  defineCachedEventHandler,
  cachedFunction,
  cachedEventHandler,
} from "./cache";

export { useStorage } from "./storage";
export { defineRenderHandler } from "./renderer";
export { defineRouteMeta } from "./meta";
export { useEvent } from "./context";

export { defineTask, runTask } from "./task";

export { defineNitroErrorHandler } from "./error/utils";

export { useDatabase } from "./database";
