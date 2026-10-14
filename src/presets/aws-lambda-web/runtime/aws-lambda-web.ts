import "#nitro/virtual/polyfills";
import { NodeRequest, serve } from "srvx/node";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { resolveServeOptions } from "#nitro/runtime/serve";
import { setupCloseHooks } from "#nitro/runtime/shutdown";

const endpoint = process.env.AWS_LAMBDA_HTTP_ENDPOINT;
const match = endpoint?.match(/^([^:]+):(\d+)$/);

if (endpoint !== undefined && (!match || +match[2] < 1 || +match[2] > 65_535)) {
  throw new Error(`Invalid AWS_LAMBDA_HTTP_ENDPOINT: ${endpoint}`);
}

const nitroApp = useNitroApp();

const server = serve(
  resolveServeOptions({
    fetch: nitroApp.fetch,
    ...(match ? { hostname: match[1], port: +match[2], protocol: "http", tls: undefined } : {}),
  })
);

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

export default {};
