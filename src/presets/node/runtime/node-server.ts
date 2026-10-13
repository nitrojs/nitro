import "#nitro/virtual/polyfills";
import { NodeRequest, serve } from "srvx/node";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { resolveServeOptions } from "#nitro/runtime/serve";
import { setupCloseHooks } from "#nitro/runtime/shutdown";

const nitroApp = useNitroApp();

const server = serve(resolveServeOptions({ fetch: nitroApp.fetch }));

if (import.meta._websocket) {
  const { handleUpgrade } = wsAdapter({ resolve: resolveWebsocketHooks });
  server.node!.server!.on("upgrade", (req, socket, head) => {
    handleUpgrade(
      req,
      socket,
      head,
      // @ts-expect-error (upgrade is not typed)
      new NodeRequest({ req, upgrade: { socket, head } })
    );
  });
}

setupCloseHooks(server);

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({ waitUntil: server.waitUntil });
}

export default {};
