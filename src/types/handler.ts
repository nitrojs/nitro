import type { HTTPError, HTTPMethod, HTTPEvent, HTTPHandler } from "h3";
import type { PresetName } from "../presets/index.ts";
import type { OperationObject, OpenAPI3, Extensable } from "../types/openapi-ts.ts";

type MaybeArray<T> = T | T[];

/** @experimental */
export interface NitroRouteMeta {
  openAPI?: OperationObject & {
    $global?: Pick<OpenAPI3, "components"> & Extensable;
  };
}

interface NitroHandlerCommon {
  /**
   * HTTP pathname pattern to match
   *
   * Examples: `/test`, `/api/:id`, `/blog/**`
   */
  route: string;

  /**
   * HTTP method to match
   */
  method?: HTTPMethod;

  /**
   * Run handler as a middleware before other route handlings
   */
  middleware?: boolean;

  /**
   * Extra Meta
   */
  meta?: NitroRouteMeta;
}

export type EventHandlerFormat = "web" | "node";

export interface NitroEventHandler extends NitroHandlerCommon {
  /**
   * Use lazy loading to import handler
   */
  lazy?: boolean;

  /**
   * Path to event handler
   */
  handler: string;

  /**
   * Event handler type.
   *
   * Default is `"web"`. If set to `"node"`, the handler will be converted into a web compatible handler.
   */
  format?: EventHandlerFormat;

  /*
   * Environments to include and bundle this handler
   */
  env?: MaybeArray<"dev" | "prod" | "prerender" | PresetName | (string & {})>;
}

export interface NitroDevEventHandler extends NitroHandlerCommon {
  /**
   * Event handler function
   */
  handler: HTTPHandler;
}

type MaybePromise<T> = T | Promise<T>;

export type NitroErrorHandler = (
  error: HTTPError,
  event: HTTPEvent,
  _: {
    defaultHandler: (
      error: HTTPError,
      event: HTTPEvent,
      opts?: { silent?: boolean; json?: boolean }
    ) => MaybePromise<{
      status: number;
      statusText: string | undefined;
      headers: Record<string, string>;
      body: string | Record<string, any>;
    }>;
  }
) => MaybePromise<Response | void>;
