import "#nitro/virtual/polyfills";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";
import { serverEntryOptions } from "#nitro/virtual/server-entry";

import type { AppEntry } from "env-runner";

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({});
}

const ws = import.meta._websocket
  ? await import("crossws/adapters/node").then((m) =>
      (m.default || m)({ resolve: resolveWebsocketHooks })
    )
  : undefined;

export default {
  ...serverEntryOptions,
  fetch: nitroApp.fetch,
  plugins: [...tracingSrvxPlugins],
  upgrade: ws
    ? (context: { node: { req: any; socket: any; head: any } }) => {
        ws.handleUpgrade(context.node.req, context.node.socket, context.node.head);
      }
    : undefined,
  ipc: {
    onOpen: (ctx) => {
      sendMessage = ctx.sendMessage;
      (globalThis as any).__nitro_renderer_template__ = () => rpc("rendererTemplate");
    },
    onMessage: (message: any) => {
      const request = message?.__rpc_id && rpcRequests.get(message.__rpc_id);
      if (!request) {
        return;
      }
      clearTimeout(request.timer);
      rpcRequests.delete(message.__rpc_id);
      if (message.error) {
        request.reject(new Error(message.error));
      } else {
        request.resolve(message.data);
      }
    },
    onClose: () => nitroHooks.callHook("close"),
  },
} satisfies AppEntry;

// ----- Worker => Host RPC -----

let sendMessage: ((message: unknown) => void) | undefined;

const rpcRequests = new Map<
  string,
  { resolve: (data: any) => void; reject: (error: Error) => void; timer: any }
>();

function rpc(name: string, timeout = 3000): Promise<any> {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      rpcRequests.delete(id);
      reject(new Error(`RPC "${name}" timed out`));
    }, timeout);
    rpcRequests.set(id, { resolve, reject, timer });
    sendMessage?.({ __rpc: name, __rpc_id: id });
  });
}
