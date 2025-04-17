import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { runCronTasks } from "nitro/runtime/internal";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";

import type {
  Request as CFRequest,
  EventContext,
  ExecutionContext,
} from "@cloudflare/workers-types";
import wsAdapter from "crossws/adapters/cloudflare";

/**
 * Reference: https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#parameters
 */

interface CFPagesEnv {
  ASSETS: { fetch: (request: CFRequest) => Promise<Response> };
  CF_PAGES: "1";
  CF_PAGES_BRANCH: string;
  CF_PAGES_COMMIT_SHA: string;
  CF_PAGES_URL: string;
  [key: string]: any;
}

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? // @ts-expect-error
    wsAdapter(nitroApp.h3App.websocket)
  : undefined;

export default {
  async fetch(
    request: CFRequest,
    env: CFPagesEnv,
    context: EventContext<CFPagesEnv, string, any>
  ) {
    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare
    if (
      import.meta._websocket &&
      request.headers.get("upgrade") === "websocket"
    ) {
      return ws!.handleUpgrade(
        request as any,
        env,
        context as unknown as ExecutionContext
      );
    }

    const url = new URL(request.url);
    if (env.ASSETS /* !miniflare */ && isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    // Expose latest env to the global context
    (globalThis as any).__env__ = env;

    return nitroApp.fetch(request as unknown as Request, undefined, {
      waitUntil: (promise: Promise<any>) => context.waitUntil(promise),
      _platform: {
        cf: request.cf,
        cloudflare: {
          request,
          env,
          context,
        },
      },
    });
  },
  scheduled(event: any, env: CFPagesEnv, context: ExecutionContext) {
    if (import.meta._tasks) {
      (globalThis as any).__env__ = env;
      context.waitUntil(
        runCronTasks(event.cron, {
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
};
