import "#nitro-internal-pollyfills";
import type * as CF from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import wsAdapter from "crossws/adapters/cloudflare-durable";
import { useNitroApp } from "nitropack/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";
import { createHandler, fetchHandler } from "./_module-handler";

const DURABLE_BINDING = "$DurableObject";
const DURABLE_INSTANCE = "server";

interface Env {
  ASSETS?: { fetch: typeof CF.fetch };
  [DURABLE_BINDING]?: CF.DurableObjectNamespace;
}

const nitroApp = useNitroApp();

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

const ws = import.meta._websocket
  ? wsAdapter({
      ...nitroApp.h3App.websocket,
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
    (globalThis as any).__env__ = this.env;
    if (
      import.meta._websocket &&
      request.headers.get("upgrade") === "websocket"
    ) {
      return ws!.handleDurableUpgrade(this, request);
    }
    // Main handler
    const url = new URL(request.url);
    return fetchHandler(request, this.env, this.ctx, url, nitroApp, {
      durable: this,
    });
  }

  publish(topic: string, data: unknown, opts: any) {
    if (!ws) {
      throw new Error("WebSocket not available");
    }
    return ws.publish(topic, data, opts);
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
    (globalThis as any).__env__ = this.env;
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
    (globalThis as any).__env__ = this.env;
    if (import.meta._websocket) {
      return ws!.handleDurableClose(this, client, code, reason, wasClean);
    }
  }
}
