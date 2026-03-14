import type { H3Core, HTTPEvent } from "h3";
import type { HookableCore } from "hookable";
import type { ServerRequest } from "srvx";

export interface NitroApp {
  fetch: (req: Request) => Response | Promise<Response>;
  h3?: H3Core;
  hooks?: HookableCore<NitroRuntimeHooks>;
  captureError?: CaptureError;
}

export interface NitroAppPlugin {
  (
    nitro: NitroApp & {
      hooks: NonNullable<NitroApp["hooks"]>;
    }
  ): void;
}

export interface NitroAsyncContext {
  request: ServerRequest;
}

export interface RenderResponse {
  body: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export type RenderHandler = (
  event: HTTPEvent
) => Partial<RenderResponse> | Promise<Partial<RenderResponse>>;

export interface RenderContext {
  event: HTTPEvent;
  render: RenderHandler;
  response?: Partial<RenderResponse>;
}

export interface CapturedErrorContext {
  event?: HTTPEvent;
  tags?: string[];
}

export type CaptureError = (error: Error, context: CapturedErrorContext) => void;

export interface NitroRuntimeHooks {
  close: () => void;
  error: CaptureError;
  request: (event: HTTPEvent) => void | Promise<void>;
  response: (res: Response, event: HTTPEvent) => void | Promise<void>;
}
