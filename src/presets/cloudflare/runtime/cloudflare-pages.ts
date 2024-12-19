import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import { requestHasBody, runCronTasks } from "nitropack/runtime/internal";
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
  ? wsAdapter(nitroApp.h3App.websocket)
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

    let body;
    if (requestHasBody(request as unknown as Request)) {
      body = Buffer.from(await request.arrayBuffer());
    }

    // Expose latest env to the global context
    (globalThis as any).__env__ = env;

    return nitroApp.localFetch(url.pathname + url.search, {
      context: {
        cf: request.cf,
        waitUntil: (promise: Promise<any>) => context.waitUntil(promise),
        cloudflare: {
          request,
          env,
          context,
        },
      },
      host: url.hostname,
      protocol: url.protocol,
      method: request.method,
      headers: request.headers as unknown as Headers,
      body,
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
