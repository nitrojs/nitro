// Config
import type { NitroConfig } from "nitro/types";
import type { ServerRequestContext } from "srvx";
import { toRequest, type H3EventContext } from "h3";

export function defineConfig(config: Omit<NitroConfig, "rootDir">): Omit<NitroConfig, "rootDir"> {
  return config;
}

// Type (only) helpers
export { defineNitroPlugin as definePlugin } from "./internal/plugin.ts";
export { defineRouteMeta } from "./internal/meta.ts";
export { defineNitroErrorHandler as defineErrorHandler } from "./internal/error/utils.ts";

// Runtime
export function serverFetch(
  resource: string | URL | Request,
  init?: RequestInit,
  context?: ServerRequestContext | H3EventContext
): Promise<Response> {
  const nitro =
    globalThis.__nitro__?.default ||
    globalThis.__nitro__?.prerender ||
    globalThis.__nitro_builder__;
  if (!nitro) {
    return Promise.reject(new Error("Nitro instance is not available."));
  }
  const req = toRequest(resource, init);
  req.context = { ...req.context, ...context };
  try {
    return Promise.resolve(nitro.fetch(req));
  } catch (error) {
    return Promise.reject(error);
  }
}

export function fetch(
  resource: string | URL | Request,
  init?: RequestInit,
  context?: ServerRequestContext | H3EventContext
): Promise<Response> {
  if (typeof resource === "string" && resource.charCodeAt(0) === 47) {
    return serverFetch(resource, init, context);
  }
  resource = (resource as any)._request || resource; // unwrap srvx request
  return globalThis.fetch(resource, init);
}
