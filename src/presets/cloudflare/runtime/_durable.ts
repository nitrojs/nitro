import { DurableObject } from "cloudflare:workers";
import wsAdapter from "crossws/adapters/cloudflare";
import { augmentReq } from "./_module-handler.ts";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { afterNitroReady } from "#nitro/runtime/async-plugins";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

const DURABLE_BINDING = "$DurableObject";
const DURABLE_INSTANCE = "server";

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

// Upgrades are forwarded to the Durable Object when its binding is declared
// https://crossws.h3.dev/adapters/cloudflare#durable-objects
export const ws = import.meta._websocket
  ? wsAdapter({
      resolve: resolveWebsocketHooks,
      instanceName: DURABLE_INSTANCE,
      bindingName: DURABLE_BINDING,
    })
  : undefined;

export class $DurableObject extends DurableObject {
  constructor(state: DurableObjectState, env: Record<string, any>) {
    super(state, env);
    state.waitUntil(
      afterNitroReady(nitroApp, () =>
        nitroHooks.callHook("cloudflare:durable:init", this, {
          state,
          env,
        })
      ) || Promise.resolve()
    );
    if (import.meta._websocket) {
      ws!.handleDurableInit(this, state, env);
    }
  }

  override fetch(request: Request) {
    augmentReq(request, {
      env: this.env as any,
      context: this.ctx as any,
    });

    if (import.meta._websocket && request.headers.get("upgrade") === "websocket") {
      return ws!.handleDurableUpgrade(this, request);
    }

    return nitroApp.fetch(request);
  }

  override alarm(): void | Promise<void> {
    this.ctx.waitUntil(
      afterNitroReady(nitroApp, () => nitroHooks.callHook("cloudflare:durable:alarm", this)) ||
        Promise.resolve()
    );
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
