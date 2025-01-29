import "#nitro-internal-pollyfills";
import type * as CF from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import wsAdapter from "crossws/adapters/cloudflare-durable";
import { useNitroApp } from "nitropack/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";
import {
  chainableCaller,
  createHandler,
  fetchHandler,
} from "./_module-handler";

const nitroApp = useNitroApp();

const DURABLE_BINDING = "$DurableObject";
const DURABLE_INSTANCE = "server";

function getDurableStub(env: Env) {
  const binding = (env as any)[DURABLE_BINDING] as CF.DurableObjectNamespace;
  const id = binding.idFromName(DURABLE_INSTANCE);
  return binding.get(id);
}

const ws = import.meta._websocket
  ? wsAdapter({
      ...nitroApp.h3App.websocket,
      instanceName: DURABLE_INSTANCE,
      bindingName: DURABLE_BINDING,
    })
  : undefined;

interface Env {
  ASSETS?: { fetch: typeof CF.fetch };
}

export default createHandler<Env>({
  async fetch(request, env, context, url) {
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
  extentEvent(event) {
    event.durableFech = () => {
      const stub = getDurableStub(event.env as Env);
      return stub.fetch(event.request);
    };
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

  override async fetch(request: Request) {
    const url = new URL(request.url);

    // Global hook for custom interceptors
    const fetchEvent = {
      durable: this,
      request: request as any,
      env: this.env,
      context: this.ctx,
      url,
    };
    const res = await nitroApp.hooks.callHookWith(
      chainableCaller,
      "cloudflare:durable:fetch",
      fetchEvent
    );
    if (res) {
      return res;
    }

    // Websocket upgrade
    if (
      import.meta._websocket &&
      request.headers.get("upgrade") === "websocket"
    ) {
      return ws!.handleDurableUpgrade(this, request);
    }

    // Main handler
    return fetchHandler(request, this.env, this.ctx, url, nitroApp);
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
