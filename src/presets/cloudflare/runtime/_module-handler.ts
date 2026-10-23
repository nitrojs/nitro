import "#nitro/virtual/polyfills";
import type * as CF from "@cloudflare/workers-types";
import type { ServerRequest, ServerRuntimeContext } from "srvx";

import { runCronTasks } from "#nitro/runtime/task";
import { afterNitroReady } from "#nitro/runtime/async-plugins";
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
      augmentReq(request as any, { env: env as any, context });

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
        afterNitroReady(nitroApp, () =>
          nitroHooks.callHook("cloudflare:scheduled", {
            controller,
            env,
            context,
          })
        ) || Promise.resolve()
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
        afterNitroReady(nitroApp, () =>
          nitroHooks.callHook("cloudflare:email", {
            message: message as any,
            env,
            context,
          })
        ) || Promise.resolve()
      );
    },

    queue(batch, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        afterNitroReady(nitroApp, () =>
          nitroHooks.callHook("cloudflare:queue", {
            batch,
            env,
            context,
          })
        ) || Promise.resolve()
      );
    },

    tail(traces, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        afterNitroReady(nitroApp, () =>
          nitroHooks.callHook("cloudflare:tail", {
            traces,
            env,
            context,
          })
        ) || Promise.resolve()
      );
    },

    trace(traces, env, context) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        afterNitroReady(nitroApp, () =>
          nitroHooks.callHook("cloudflare:trace", {
            traces,
            env,
            context,
          })
        ) || Promise.resolve()
      );
    },
  } satisfies ExportedHandler<Env>;
}

export function augmentReq(
  cfReq: Request | CF.Request,
  ctx: NonNullable<ServerRuntimeContext["cloudflare"]>
) {
  const req = cfReq as ServerRequest;

  req.ip = cfReq.headers.get("cf-connecting-ip") || undefined;

  req.runtime ??= { name: "cloudflare" };
  req.runtime.cloudflare = { ...req.runtime.cloudflare, ...ctx };
  req.waitUntil = ctx.context?.waitUntil.bind(ctx.context);
}

export async function fetchPublicAsset(
  assets: { fetch: (request: any) => Promise<any> },
  cfReq: Request | CF.Request
): Promise<Response> {
  const res: Response = await assets.fetch(cfReq);
  // The `_headers` rule of a public assets base also applies to a missing
  // file. Do not let browsers cache that 404 for the lifetime of the assets.
  if (
    res.status === 404 &&
    /max-age=[1-9]|immutable/i.test(res.headers.get("cache-control") || "")
  ) {
    const notFound = new Response(res.body, res);
    notFound.headers.set("cache-control", "no-store");
    return notFound;
  }
  return res;
}
