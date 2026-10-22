import { defineWebSocketHandler } from "nitro";

export default defineWebSocketHandler({
  upgrade(request) {
    const offered = request.headers.get("sec-websocket-protocol")?.split(",") || [];
    if (offered.some((protocol) => protocol.trim() === "graphql-transport-ws")) {
      return { protocol: "graphql-transport-ws" };
    }
  },
  open(peer) {
    peer.send("ready");
  },
});
