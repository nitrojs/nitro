import type { AppOptions, App as H3App, H3Event, Router } from "h3";
import type { Hookable } from "hookable";
import type { AbstractRequest, AbstractResponse } from "node-mock-http";
import type { NitroEventHandler } from "nitro/types";

export interface NitroApp {
  h3App: H3App;
  router: Router;
  handlers: NitroEventHandler[];
  hooks: Hookable<NitroRuntimeHooks>;
  localCall: (aRequest: AbstractRequest) => Promise<AbstractResponse>;
  localFetch: (
    req: string | URL | Request,
    init?: RequestInit & AbstractRequest
  ) => Promise<Response>;
  captureError: CaptureError;
}

export interface NitroAppPlugin {
  (nitro: NitroApp): void;
}

export interface NitroAsyncContext {
  event: H3Event;
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

  request: NonNullable<AppOptions["onRequest"]>;
  beforeResponse: NonNullable<AppOptions["onBeforeResponse"]>;
  afterResponse: NonNullable<AppOptions["onAfterResponse"]>;

  "render:before": (context: RenderContext) => void;

  "render:response": (
    response: Partial<RenderResponse>,
    context: RenderContext
  ) => void;
}
