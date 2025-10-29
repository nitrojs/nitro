import "#nitro-internal-pollyfills";
import type * as CF from "@cloudflare/workers-types";
import type { ExportedHandler } from "@cloudflare/workers-types";
import { useNitroApp, useNitroHooks } from "nitro/runtime";
import { runCronTasks } from "nitro/runtime/internal";
import type { ServerRequest } from "srvx";

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

  return <ExportedHandler<Env>>{
    async fetch(request, env, context) {
      const ctxExt = {};
      const url = new URL(request.url);

      // Preset-specific logic
      if (hooks.fetch) {
        const res = await hooks.fetch(request, env, context, url, ctxExt);
        if (res) {
          return res;
        }
      }

      return fetchHandler(request, env, context, url, nitroApp, ctxExt);
    },

    scheduled(controller, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroHooks.callHook("cloudflare:scheduled", {
          controller,
          env,
          context,
        })
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
        })
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
        })
      );
    },

    tail(traces, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroHooks.callHook("cloudflare:tail", {
          traces,
          env,
          context,
        })
      );
    },

    trace(traces, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroHooks.callHook("cloudflare:trace", {
          traces,
          env,
          context,
        })
      );
    },
  };
}

export async function fetchHandler(
  cfReq: Request | CF.Request,
  env: unknown,
  context: CF.ExecutionContext | DurableObjectState,
  url: URL = new URL(cfReq.url),
  nitroApp = useNitroApp(),
  ctxExt: any
) {
  // Expose latest env to the global context
  (globalThis as any).__env__ = env;

  // srvx compatibility
  const req = cfReq as ServerRequest;
  req.runtime ??= { name: "cloudflare" };
  req.runtime.cloudflare ??= { context, env } as any;
  req.waitUntil = context.waitUntil.bind(context);

  return nitroApp.fetch(req) as unknown as Promise<Response>;
}
