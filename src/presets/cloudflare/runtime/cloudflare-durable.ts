import "#nitro/virtual/polyfills";
import type * as CF from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import wsAdapter from "crossws/adapters/cloudflare";
import { createHandler, augmentReq } from "./_module-handler.ts";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

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
    throw new Error(`Durable Object binding "${DURABLE_BINDING}" not available.`);
  }
  const id = binding.idFromName(DURABLE_INSTANCE);
  return binding.get(id);
};

const ws = import.meta._websocket
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
      return env.ASSETS.fetch(request as any);
    }

    // Expose stub fetch to the context
    ctxExt.durableFetch = (req = request) => getDurableStub(env).fetch(req as any);

    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare#durable-objects
    if (import.meta._websocket && request.headers.get("upgrade") === "websocket") {
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
    if (import.meta._websocket) {
      ws!.handleDurableInit(this, state, env);
    }
  }

  override fetch(request: Request) {
    augmentReq(request, {
      env: this.env,
      context: this.ctx as any,
    });

    if (import.meta._websocket && request.headers.get("upgrade") === "websocket") {
      return ws!.handleDurableUpgrade(this, request);
    }

    return nitroApp.fetch(request);
  }

  override alarm(): void | Promise<void> {
    this.ctx.waitUntil(nitroHooks.callHook("cloudflare:durable:alarm", this) || Promise.resolve());
  }

  override async webSocketMessage(client: WebSocket, message: ArrayBuffer | string) {
    if (import.meta._websocket) {
      return ws!.handleDurableMessage(this, client, message);
    }
  }

  override async webSocketClose(
    client: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    if (import.meta._websocket) {
      return ws!.handleDurableClose(this, client, code, reason, wasClean);
    }
  }
}
