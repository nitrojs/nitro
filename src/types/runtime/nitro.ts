import type { H3Core, HTTPEvent } from "h3";
import type { HookableCore } from "../_hookable.ts";
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
  /**
   * Set while async plugins are still initializing and resolves once all
   * plugins have finished. `undefined` when the app is ready.
   *
   * Requests to `fetch` are held until then automatically.
   */
  ready?: Promise<void>;
}

/**
 * A Nitro runtime plugin function.
 *
 * Receives the {@link NitroApp} instance (with `hooks` guaranteed to exist)
 * and can register runtime hooks or modify the app.
 *
 * A plugin can be async: the plugins after it run once it resolves, and
 * requests are held until all plugins have finished.
 *
 * @see https://nitro.build/docs/plugins
 */
export interface NitroAppPlugin {
  (
    nitro: NitroApp & {
      hooks: NonNullable<NitroApp["hooks"]>;
    }
  ): void | Promise<void>;
}

export interface NitroAsyncContext {
  request: ServerRequest;
}

/** Context provided when an error is captured at runtime. */
export interface CapturedErrorContext {
  event?: HTTPEvent;
  tags?: string[];
}

/** Context of the `shutdown` runtime hook. */
export interface NitroShutdownContext {
  /**
   * Keep the shutdown pending until the promise settles, for up to the graceful shutdown
   * timeout. Can be called until in-flight requests are drained and all registered work has
   * settled. `close` hooks are called after that. Ignored once the timeout is reached.
   */
  waitUntil: (promise: Promise<unknown>) => void;
  /** Aborted when the graceful shutdown timeout is reached. */
  signal: AbortSignal;
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
  /**
   * Called as soon as the server starts shutting down, while in-flight requests are drained
   * and before `close` hooks.
   *
   * Hooks are called in order: register long-running work with `ctx.waitUntil` instead of
   * awaiting it, so that other hooks are not delayed.
   *
   * Only called by the `node_server`, `node_cluster`, `bun` and `deno_server` presets.
   */
  shutdown: (ctx: NitroShutdownContext) => void | Promise<void>;
  error: CaptureError;
  request: (event: HTTPEvent) => void | Promise<void>;
  response: (res: Response, event: HTTPEvent) => void | Promise<void>;
}
