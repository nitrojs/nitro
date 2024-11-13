import "#nitro-internal-pollyfills";
import type * as CF from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import wsAdapter from "crossws/adapters/cloudflare-durable";
import { useNitroApp } from "nitropack/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";
import { createHandler } from "./_module-handler";

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
  : undefined;

interface Env {
  ASSETS?: { fetch: typeof CF.fetch };
}

export default createHandler<Env>({
  fetch(request, env, context, url) {
    // Static assets fallback (optional binding)
    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare#durable-objects
    if (
      import.meta._websocket &&
      request.headers.get("upgrade") === "websocket"
    ) {
      return ws!.handleUpgrade(request, env, context);
    }
  },
});

export class $DurableObject extends DurableObject {
  constructor(state: DurableObjectState, env: Record<string, any>) {
    super(state, env);
    state.waitUntil(
      nitroApp.hooks.callHook("cloudflare:durable:init", this, {
        state,
        env,
      })
    );
    if (import.meta._websocket) {
      ws!.handleDurableInit(this, state, env);
    }
  }

  override fetch(request: Request) {
    if (import.meta._websocket) {
      return ws!.handleDurableUpgrade(this, request);
    }
    return new Response("404", { status: 404 });
  }

  override alarm(): void | Promise<void> {
    this.ctx.waitUntil(
      nitroApp.hooks.callHook("cloudflare:durable:alarm", this)
    );
  }

  override async webSocketMessage(
    client: WebSocket,
    message: ArrayBuffer | string
  ) {
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
