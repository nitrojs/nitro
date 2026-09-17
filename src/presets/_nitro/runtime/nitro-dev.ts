import "#nitro/virtual/polyfills";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { appFetchPlugin } from "#nitro/runtime/serve";
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
  fetch: nitroApp["~fetch"],
  plugins: [...tracingSrvxPlugins, ...(serverEntryOptions.plugins || []), appFetchPlugin],
  upgrade: ws
    ? (context: { node: { req: any; socket: any; head: any } }) => {
        ws.handleUpgrade(context.node.req, context.node.socket, context.node.head);
      }
    : undefined,
  ipc: {
    onClose: () => nitroHooks.callHook("close"),
  },
} satisfies AppEntry;
