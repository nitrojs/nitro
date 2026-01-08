import "#nitro/virtual/polyfills";
import type * as CF from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import wsAdapter from "crossws/adapters/cloudflare";
import { createHandler, fetchHandler } from "./_module-handler.ts";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { hasWebSocket } from "#nitro/virtual/feature-flags";

const DURABLE_BINDING = "$DurableObject";
const DURABLE_INSTANCE = "server";

interface Env {
  ASSETS?: { fetch: typeof CF.fetch };
  [DURABLE_BINDING]?: CF.DurableObjectNamespace;
}

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

const getDurableStub = (env: Env) => {
  const binding = env[DURABLE_BINDING];
  if (!binding) {
    throw new Error(
      `Durable Object binding "${DURABLE_BINDING}" not available.`
    );
  }
  const id = binding.idFromName(DURABLE_INSTANCE);
  return binding.get(id);
};

const ws = hasWebSocket
  ? wsAdapter({
      resolve: resolveWebsocketHooks,
      instanceName: DURABLE_INSTANCE,
      bindingName: DURABLE_BINDING,
    })
  : undefined;

export default createHandler<Env>({
  fetch(request, env, context, url, ctxExt) {
    // Static assets fallback (optional binding)
    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    // Expose stub fetch to the context
    ctxExt.durableFetch = (req = request) => getDurableStub(env).fetch(req);

    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare#durable-objects
    if (hasWebSocket && request.headers.get("upgrade") === "websocket") {
      // Ensure Cloudflare bindings are available on `peer.context` inside WebSocket handlers.
      // crossws will forward `request.context` to `peer.context`.
      let wsContext = (request as any).context;
      if (!wsContext) {
        wsContext = {};
        Object.defineProperty(request as any, "context", {
          enumerable: true,
          value: wsContext,
        });
      }
      wsContext.cloudflare ||= {};
      wsContext.cloudflare.env ||= env;
      wsContext.cloudflare.context ||= context;
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
      }) || Promise.resolve()
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
    this.ctx.waitUntil(
      nitroHooks.callHook("cloudflare:durable:alarm", this) || Promise.resolve()
    );
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
