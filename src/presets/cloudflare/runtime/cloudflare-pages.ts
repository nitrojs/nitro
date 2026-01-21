import "#nitro/virtual/polyfills";
import type {
  Request as CFRequest,
  EventContext,
  ExecutionContext,
} from "@cloudflare/workers-types";
import wsAdapter from "crossws/adapters/cloudflare";

import { useNitroApp } from "nitro/app";
import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { runCronTasks } from "#nitro/runtime/task";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

import { augmentReq } from "./_module-handler.ts";

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
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

export default {
  async fetch(
    cfReq: CFRequest,
    env: CFPagesEnv,
    context: EventContext<CFPagesEnv, string, any>
  ) {
    augmentReq(cfReq, {
      env,
      context: context as any,
    });

    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare
    if (
      import.meta._websocket &&
      cfReq.headers.get("upgrade") === "websocket"
    ) {
      return ws!.handleUpgrade(
        cfReq,
        env,
        context as unknown as ExecutionContext
      );
    }

    const url = new URL(cfReq.url);
    if (env.ASSETS /* !miniflare */ && isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(cfReq);
    }

    return nitroApp.fetch(cfReq as any);
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
