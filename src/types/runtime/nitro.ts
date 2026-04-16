import type { H3Core, HTTPEvent } from "h3";
import type { HookableCore } from "hookable";
import type { ServerRequest } from "srvx";

/**
 * The runtime Nitro application instance accessible via `useNitroApp()`.
 *
 * @see https://nitro.build/docs/plugins
 */
export interface NitroApp {
  fetch: (req: Request) => Response | Promise<Response>;
  h3?: H3Core;
  hooks?: HookableCore<NitroRuntimeHooks>;
  captureError?: CaptureError;
}

/**
 * A Nitro runtime plugin function.
 *
 * Receives the {@link NitroApp} instance (with `hooks` guaranteed to exist)
 * and can register runtime hooks or modify the app.
 *
 * @see https://nitro.build/docs/plugins
 */
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

/** Context provided when an error is captured at runtime. */
export interface CapturedErrorContext {
  event?: HTTPEvent;
  tags?: string[];
}

/** Error capture callback used by `nitroApp.captureError`. */
export type CaptureError = (error: Error, context: CapturedErrorContext) => void;

/**
 * Runtime hooks available in Nitro plugins.
 *
 * @see https://nitro.build/docs/plugins
 * @see https://nitro.build/docs/lifecycle
 */
export interface NitroRuntimeHooks {
  close: () => void;
  error: CaptureError;
  request: (event: HTTPEvent) => void | Promise<void>;
  response: (res: Response, event: HTTPEvent) => void | Promise<void>;
}
