import "#nitro-internal-pollyfills";
import type * as CF from "@cloudflare/workers-types";
import type { ExportedHandler } from "@cloudflare/workers-types";
import { useNitroApp } from "nitropack/runtime";
import { requestHasBody, runCronTasks } from "nitropack/runtime/internal";

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
        nitroApp.hooks.callHook("cloudflare:scheduled", {
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
        nitroApp.hooks.callHook("cloudflare:email", {
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
        nitroApp.hooks.callHook("cloudflare:queue", {
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
        nitroApp.hooks.callHook("cloudflare:tail", {
          traces,
          env,
          context,
        })
      );
    },

    trace(traces, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        nitroApp.hooks.callHook("cloudflare:trace", {
          traces,
          env,
          context,
        })
      );
    },
  };
}

export async function fetchHandler(
  request: Request | CF.Request,
  env: unknown,
  context: CF.ExecutionContext | DurableObjectState,
  url: URL = new URL(request.url),
  nitroApp = useNitroApp(),
  ctxExt: any
) {
  let body;
  if (requestHasBody(request as unknown as Request)) {
    body = Buffer.from(await request.arrayBuffer());
  }

  // Expose latest env to the global context
  (globalThis as any).__env__ = env;

  return nitroApp.localFetch(url.pathname + url.search, {
    context: {
      cf: (request as any).cf,
      waitUntil: (promise: Promise<any>) => context.waitUntil(promise),
      cloudflare: {
        request,
        env,
        context,
        url,
        ...ctxExt,
      },
    },
    host: url.hostname,
    protocol: url.protocol,
    method: request.method,
    headers: request.headers as unknown as Headers,
    body,
  }) as unknown as Promise<Response>;
}
