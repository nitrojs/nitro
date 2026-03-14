import "#nitro-internal-polyfills";
import type * as CF from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import wsAdapter from "crossws/adapters/cloudflare";
import { createHandler, fetchHandler } from "./_module-handler.ts";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import {
  bindingName,
  instanceName,
  resolveInstanceName,
} from "#nitro/virtual/cloudflare-durable";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { hasWebSocket } from "#nitro/virtual/feature-flags";
import { getDurableStub } from "./_durable.ts";

interface Env {
  ASSETS?: { fetch: typeof CF.fetch };
  [key: string]: unknown;
}

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

const ws = hasWebSocket
  ? wsAdapter({
      resolve: resolveWebsocketHooks,
      resolveDurableStub(request, env, context) {
        return getDurableStub({
          bindingName,
          instanceName,
          request: request as Request | undefined,
          env: env as Env,
          context,
          resolveInstanceName,
        });
      },
    })
  : undefined;

export default createHandler<Env>({
  fetch(request, env, context, url, ctxExt) {
    // Static assets fallback (optional binding)
    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    // Expose stub fetch to the context
    ctxExt.durableFetch = async (req = request) =>
      (
        await getDurableStub({
          bindingName,
          instanceName,
          request,
          env,
          context,
          resolveInstanceName,
        })
      ).fetch(req as any);

    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare#durable-objects
    if (hasWebSocket && request.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(request, env, context);
    }
  },
});

export class $DurableObject extends DurableObject {
  constructor(state: DurableObjectState, env: Record<string, any>) {
    super(state, env);
    state.waitUntil(
      nitroHooks.callHook("cloudflare:durable:init", this, {
        state,
        env,
      })
    );
    if (hasWebSocket) {
      ws!.handleDurableInit(this, state, env);
    }
  }

  override fetch(request: Request) {
    if (hasWebSocket && request.headers.get("upgrade") === "websocket") {
      return ws!.handleDurableUpgrade(this, request);
    }
    // Main handler
    const url = new URL(request.url);
    return fetchHandler(request, this.env, this.ctx, url, nitroApp, {
      durable: this,
    });
  }

  override alarm(): void | Promise<void> {
    this.ctx.waitUntil(nitroHooks.callHook("cloudflare:durable:alarm", this));
  }

  override async webSocketMessage(
    client: WebSocket,
    message: ArrayBuffer | string
  ) {
    if (hasWebSocket) {
      return ws!.handleDurableMessage(this, client, message);
    }
  }

  override async webSocketClose(
    client: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    if (hasWebSocket) {
      return ws!.handleDurableClose(this, client, code, reason, wasClean);
    }
  }
}
