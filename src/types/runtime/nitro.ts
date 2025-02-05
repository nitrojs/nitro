import type { App as H3App, H3Event, Router } from "h3";
import type { Hookable } from "hookable";
import type { NitroRuntimeHooks as NitroTypesRuntimeHooks } from "nitropack";
import type { AbstractRequest, AbstractResponse } from "node-mock-http";

export interface NitroApp {
  h3App: H3App;
  router: Router;
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

export interface NitroRuntimeHooks extends NitroTypesRuntimeHooks {}
