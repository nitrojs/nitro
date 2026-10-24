// Config
import type { NitroConfig } from "nitro/types";
import type { ServerRequestContext } from "srvx";
import { toRequest } from "h3";

export function defineConfig(config: Omit<NitroConfig, "rootDir">): Omit<NitroConfig, "rootDir"> {
  return config;
}

// Type (only) helpers
export { definePlugin } from "./internal/plugin.ts";
export { defineRouteMeta } from "./internal/meta.ts";
export { defineErrorHandler } from "./internal/error/utils.ts";
export { defineServerEntry } from "./internal/server-entry.ts";

// H3
export {
  defineHandler,
  defineMiddleware,
  defineWebSocketHandler,
  html,
  HTTPError,
  HTTPResponse,
} from "h3";
export type { H3Event, EventHandlerRequest, EventHandlerWithFetch } from "h3";

// srvx
export type { FastResponse } from "srvx";

export interface ServerFetchInit extends RequestInit {
  context?: ServerRequestContext;
}

// Runtime
export function serverFetch(
  input: string | URL | Request,
  init?: ServerFetchInit
): Promise<Response> {
  const nitro =
    globalThis.__nitro__?.default ||
    globalThis.__nitro__?.prerender ||
    globalThis.__nitro_builder__;
  if (!nitro) {
    return Promise.reject(new Error("Nitro instance is not available."));
  }
  const req = toRequest(input, init);
  if (init?.context) {
    req.context = { ...req.context, ...init.context } as ServerRequestContext;
  }
  try {
    return Promise.resolve(nitro.fetch(req));
  } catch (error) {
    return Promise.reject(error);
  }
}

export function fetch(
  input: RequestInfo | URL,
  init?: ServerFetchInit
): Promise<Response> {
  if (typeof input === "string" && input.charCodeAt(0) === 47) {
    return serverFetch(input, init);
  }
  input = (input as any)._request || input; // unwrap srvx request
  return globalThis.fetch(input, init);
}
