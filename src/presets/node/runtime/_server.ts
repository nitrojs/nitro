import { NodeRequest, serve } from "srvx/node";
import type { ServerOptions } from "srvx";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { resolveServeOptions } from "#nitro/runtime/serve";
import { setupCloseHooks } from "#nitro/runtime/shutdown";

export function startNodeServer(options: Partial<ServerOptions> = {}) {
  const nitroApp = useNitroApp();
  const server = serve(resolveServeOptions({ fetch: nitroApp.fetch, ...options }));

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

  return server;
}
