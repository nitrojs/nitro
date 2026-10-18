import type { NitroApp, NitroAppPlugin } from "nitro/types";
import type { H3Core } from "h3";

/**
 * Continues plugin initialization once `pending` (the result of an async plugin)
 * settles, running the remaining plugins in order.
 *
 * Until then, `nitroApp.ready` is set and every request is held in `onRequest`.
 * The original `onRequest` is restored afterwards, so a ready app has no
 * per-request cost.
 *
 * A failure is reported once as an unhandled rejection (like a sync plugin that
 * throws), whether or not held requests or events are waiting on `ready`.
 */
export function initAsyncPlugins(
  app: NitroApp,
  pending: PromiseLike<unknown>,
  plugins: NitroAppPlugin[]
): NitroApp {
  const h3 = app.h3 as H3Core;
  const onRequest = h3.config.onRequest;
  // A plugin may wrap `onRequest` while the gate is installed, keeping it in the chain.
  const gate: typeof onRequest = (event) =>
    app.ready ? app.ready.then(() => onRequest?.(event)) : onRequest?.(event);
  h3.config.onRequest = gate;
  const ready = (async () => {
    await pending;
    for (const plugin of plugins) {
      await plugin(app as Parameters<NitroAppPlugin>[0]);
    }
  })().then(
    () => {
      if (h3.config.onRequest === gate) {
        h3.config.onRequest = onRequest;
      }
      h3["~dispatch"] = h3["~composed"] = undefined;
      app.ready = undefined;
    },
    (error) => {
      app.captureError?.(error, { tags: ["plugin"] });
      throw error;
    }
  );
  app.ready = ready;
  ready.then();
  return app;
}

/**
 * Calls `fn` once async plugins have finished (or right away when the app is ready).
 *
 * For entry points that do not go through `nitroApp.fetch`, such as platform
 * events dispatched as runtime hooks.
 */
export function afterNitroReady<T>(app: NitroApp, fn: () => T): T | Promise<T> {
  return app.ready ? app.ready.then(fn) : fn();
}
