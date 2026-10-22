import { defineWebSocketHandler } from "nitro";

// Accepts the offered subprotocol, like a route proxying the HMR socket of an upstream Vite.
export default defineWebSocketHandler({
  upgrade(request) {
    const protocol = request.headers.get("sec-websocket-protocol")?.split(",")[0]?.trim();
    return protocol ? { protocol } : undefined;
  },
  open(peer) {
    peer.send("nitro");
  },
});
