import type { HTTPError, HTTPMethod, HTTPEvent, HTTPHandler } from "h3";
import type { PresetName } from "../presets/index.ts";
import type { OperationObject, OpenAPI3, Extensable } from "../types/openapi-ts.ts";

type MaybeArray<T> = T | T[];

/**
 * Route-level metadata attached to event handlers.
 *
 * @experimental
 * @see https://nitro.build/docs/routing
 */
export interface NitroRouteMeta {
  openAPI?: OperationObject & {
    $global?: Pick<OpenAPI3, "components"> & Extensable;
  };
}

interface NitroHandlerCommon {
  /**
   * HTTP pathname pattern to match.
   *
   * @example "/test", "/api/:id", "/blog/**"
   */
  route: string;

  /**
   * HTTP method to match.
   */
  method?: HTTPMethod;

  /**
   * Run handler as a middleware before other route handlers.
   */
  middleware?: boolean;

  /**
   * Route metadata (e.g. OpenAPI operation info).
   */
  meta?: NitroRouteMeta;
}

/**
 * Handler module format.
 *
 * - `"web"` — standard Web API handler (default).
 * - `"node"` — Node.js-style handler, automatically converted to web-compatible.
 */
export type EventHandlerFormat = "web" | "node";

/**
 * Event handler registration for build-time bundling.
 *
 * Handlers are file references that the bundler imports and transforms.
 * For runtime-only handlers in development, use {@link NitroDevEventHandler}.
 *
 * @see https://nitro.build/config#handlers
 * @see https://nitro.build/docs/routing
 */
export interface NitroEventHandler extends NitroHandlerCommon {
  /**
   * Use lazy loading to import handler.
   */
  lazy?: boolean;

  /**
   * Path to event handler.
   */
  handler: string;

  /**
   * Event handler type.
   *
   * Default is `"web"`. If set to `"node"`, the handler will be converted into a web compatible handler.
   */
  format?: EventHandlerFormat;

  /**
   * Environments to include and bundle this handler.
   *
   * @example
   * ```ts
   * env: ["dev", "prod"]
   * env: "prerender"
   * ```
   */
  env?: MaybeArray<"dev" | "prod" | "prerender" | PresetName | (string & {})>;
}

/**
 * Development-only event handler with an inline handler function.
 *
 * These handlers are available only during `nitro dev` and are not
 * included in production builds.
 *
 * @see https://nitro.build/config#devhandlers
 */
export interface NitroDevEventHandler extends NitroHandlerCommon {
  /**
   * Event handler function.
   */
  handler: HTTPHandler;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * Custom error handler function signature.
 *
 * Receives the error, the H3 event, and a helper object containing the
 * `defaultHandler` for fallback rendering.
 *
 * @see https://nitro.build/config#errorhandler
 */
export type NitroErrorHandler = (
  error: HTTPError,
  event: HTTPEvent,
  _: {
    defaultHandler: (
      error: HTTPError,
      event: HTTPEvent,
      opts?: { silent?: boolean; json?: boolean }
    ) => MaybePromise<{
      status?: number;
      statusText?: string;
      headers?: HeadersInit;
      body?: string | Record<string, any>;
    }>;
  }
) => MaybePromise<Response | void>;
