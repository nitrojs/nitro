import type { ServerPlugin, ServerRequest } from "srvx";
import type { ResolveHooks } from "crossws";
import bunAdapter from "crossws/adapters/bun";
import denoAdapter from "crossws/adapters/deno";

/**
 * srvx plugin handling WebSocket upgrades with `crossws` on Bun and Deno native servers.
 *
 * Node.js listeners proxy raw upgrade sockets instead (see `NitroDevServer.upgrade()`).
 */
export function webSocketPlugin(resolve: ResolveHooks): ServerPlugin {
  return (server) => {
    if (server.runtime === "bun") {
      server.options.bun ??= {};
      if (server.options.bun.websocket) {
        return; // User provided handlers
      }
      const ws = bunAdapter({ resolve });
      server.options.bun.websocket = ws.websocket;
      server.options.middleware.unshift((req, next) =>
        // Resolves `undefined` once Bun took over the connection
        isUpgrade(req)
          ? (ws.handleUpgrade(req, req.runtime!.bun!.server) as Promise<Response>)
          : next()
      );
    } else if (server.runtime === "deno") {
      const ws = denoAdapter({ resolve });
      server.options.middleware.unshift((req, next) =>
        isUpgrade(req) ? ws.handleUpgrade(req, req.runtime!.deno!.info) : next()
      );
    }
  };
}

function isUpgrade(req: ServerRequest) {
  return req.headers.get("upgrade")?.toLowerCase() === "websocket";
}
