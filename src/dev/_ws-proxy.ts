import { createWebSocketProxy } from "crossws";
import type { WorkerAddress } from "env-runner";

type CrosswsPlugin = Awaited<typeof import("crossws/server/bun")>["plugin"];
type SrvxPlugin = ReturnType<CrosswsPlugin>;

/**
 * Create a runtime-native WebSocket reverse-proxy plugin for the dev server.
 *
 * Under Bun (`--bun`) and Deno the parent server runs on the native srvx
 * adapter, so the Node.js `http.Server` `"upgrade"` event + raw socket proxy
 * (httpxy) is not available: Bun silently drops manual upgrade writes and its
 * `node:http` client never surfaces the `101` response. Instead we terminate
 * the client WebSocket with crossws and proxy it to the dev worker using a
 * standard `WebSocket` client, which works across all runtimes.
 */
export async function createWebSocketProxyPlugin(
  getAddress: () => WorkerAddress | undefined
): Promise<SrvxPlugin> {
  const { plugin } =
    "Bun" in globalThis
      ? await import("crossws/server/bun")
      : "Deno" in globalThis
        ? await import("crossws/server/deno")
        : await import("crossws/server/node");
  const proxy = createWebSocketProxy({
    target: (peer) => {
      const addr = getAddress();
      if (!addr?.port) {
        throw new Error("Dev worker is not ready");
      }
      const { pathname, search } = new URL(peer.request.url);
      return `ws://${addr.host || "127.0.0.1"}:${addr.port}${pathname}${search}`;
    },
    // Resolve the forwarded subprotocol defensively: on Deno the request is no
    // longer readable inside the `open` hook (after `Deno.upgradeWebSocket()`).
    forwardProtocol: (peer) => {
      try {
        const header = peer.request.headers.get("sec-websocket-protocol");
        return header
          ? header
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean)
          : undefined;
      } catch {
        return undefined;
      }
    },
  });

  // The upgrade can arrive before the dev worker has reported its address
  // (e.g. right after a reload). The `upgrade` hook is awaited by every srvx
  // adapter, so wait here for the worker to become ready before proxying.
  const hooks = {
    ...proxy,
    async upgrade(request: Request) {
      for (let i = 0; i < 200 && !getAddress()?.port; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return proxy.upgrade?.(request);
    },
  };

  return plugin({ resolve: () => hooks });
}
