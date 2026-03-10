import "#nitro/virtual/polyfills";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

import type { AppEntry } from "env-runner";

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({});
}

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

export default {
  fetch: nitroApp.fetch,
  upgrade: ws
    ? (context: { node: { req: any; socket: any; head: any } }) => {
        ws.handleUpgrade(context.node.req, context.node.socket, context.node.head);
      }
    : undefined,
  ipc: {
    onClose: () => nitroHooks.callHook("close"),
  },
} satisfies AppEntry;
