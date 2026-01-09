import "#nitro/virtual/polyfills";
import type * as CF from "@cloudflare/workers-types";
import type { ServerRequest } from "srvx";

import { runCronTasks } from "#nitro/runtime/task";
import { useNitroApp, useNitroHooks } from "nitro/app";

type MaybePromise<T> = T | Promise<T>;

export function createHandler<Env>(hooks: {
  fetch: (
    ...params: [
      ...Parameters<NonNullable<ExportedHandler<Env>["fetch"]>>,
      url: URL,
      cfContextExtras: any,
    ]
  ) => MaybePromise<Response | CF.Response | undefined>;
}) {
  const nitroApp = useNitroApp();
  const nitroHooks = useNitroHooks();

  return {
    async fetch(request, env, context) {
      (globalThis as any).__env__ = env;
      augmentReq(request as any, env, context);

      const ctxExt = {};
      const url = new URL(request.url);

      // Preset-specific logic
      if (hooks.fetch) {
        const res = await hooks.fetch(request, env, context, url, ctxExt);
        if (res) {
          return res;
        }
      }

      return (await nitroApp.fetch(request)) as any;
    },

    scheduled(controller, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroHooks.callHook("cloudflare:scheduled", {
          controller,
          env,
          context,
        }) || Promise.resolve()
      );
      if (import.meta._tasks) {
        context.waitUntil(
          runCronTasks(controller.cron, {
            context: {
              cloudflare: {
                env,
                context,
              },
            },
            payload: {},
          })
        );
      }
    },

    email(message, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroHooks.callHook("cloudflare:email", {
          message,
          event: message, // backward compat
          env,
          context,
        }) || Promise.resolve()
      );
    },

    queue(batch, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroHooks.callHook("cloudflare:queue", {
          batch,
          event: batch,
          env,
          context,
        }) || Promise.resolve()
      );
    },

    tail(traces, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroHooks.callHook("cloudflare:tail", {
          traces,
          env,
          context,
        }) || Promise.resolve()
      );
    },

    trace(traces, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroHooks.callHook("cloudflare:trace", {
          traces,
          env,
          context,
        }) || Promise.resolve()
      );
    },
  } satisfies ExportedHandler<Env>;
}

export function augmentReq(
  cfReq: Request | CF.Request,
  env: unknown,
  context: CF.ExecutionContext | DurableObjectState
) {
  const req = cfReq as ServerRequest;
  req.runtime ??= { name: "cloudflare" };
  (req.runtime as any).cloudflare = {
    ...(req.runtime as any).cloudflare,
    env,
    context,
  };
  req.waitUntil = context.waitUntil.bind(context);
}
