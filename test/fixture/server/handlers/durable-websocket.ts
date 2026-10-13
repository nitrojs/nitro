import { defineWebSocketHandler } from "nitro";

export default defineWebSocketHandler({
  open(peer) {
    peer.send(String(peer.peers.size));
  },
});
