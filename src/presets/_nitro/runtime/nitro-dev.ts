import "#nitro/virtual/polyfills";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";
import { serverEntryOptions } from "#nitro/virtual/server-entry";
import { createDevRPC } from "#nitro/runtime/dev-rpc";

import type { AppEntry } from "env-runner";

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

let sendMessage: ((message: unknown) => void) | undefined;
const rpc = createDevRPC((message) => sendMessage?.(message));

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
      (globalThis as any).__nitro_renderer_template__ = () => rpc.call("rendererTemplate");
    },
    onMessage: (message) => {
      rpc.handleMessage(message);
    },
    onClose: () => nitroHooks.callHook("close"),
  },
} satisfies AppEntry;
