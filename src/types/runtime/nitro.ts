import type { H3, H3Event, H3EventContext, H3Config } from "h3";
import type { Hookable } from "hookable";
import type { ServerRequest } from "srvx/types";

export interface NitroApp {
  h3App: H3;
  hooks: Hookable<NitroRuntimeHooks>;
  fetch: (
    req: string | URL | Request,
    init?: RequestInit & { h3?: H3EventContext }
  ) => Promise<Response>;
  captureError: CaptureError;
}

export interface NitroAppPlugin {
  (nitro: NitroApp): void;
}

export interface NitroAsyncContext {
  request: ServerRequest;
}

export interface RenderResponse {
  body: any;
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
}

export type RenderHandler = (
  event: H3Event
) => Partial<RenderResponse> | Promise<Partial<RenderResponse>>;

export interface RenderContext {
  event: H3Event;
  render: RenderHandler;
  response?: Partial<RenderResponse>;
}

export interface CapturedErrorContext {
  event?: H3Event;
  [key: string]: unknown;
}

export type CaptureError = (
  error: Error,
  context: CapturedErrorContext
) => void;

export interface NitroRuntimeHooks {
  close: () => void;
  error: CaptureError;

  request: NonNullable<H3Config["onRequest"]>;
  beforeResponse: NonNullable<H3Config["onBeforeResponse"]>;

  "render:before": (context: RenderContext) => void;

  "render:response": (
    response: Partial<RenderResponse>,
    context: RenderContext
  ) => void;
}
