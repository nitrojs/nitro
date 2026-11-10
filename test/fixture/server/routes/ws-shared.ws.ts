import { defineRouteMeta, defineWebSocketHandler } from "nitro";

defineRouteMeta({
  openAPI: {
    description: "WebSocket",
    $global: {
      components: { schemas: { WebSocketMessage: { type: "string" } } },
    },
  },
});

export default defineWebSocketHandler({
  open(peer) {
    peer.send("ws");
  },
});
