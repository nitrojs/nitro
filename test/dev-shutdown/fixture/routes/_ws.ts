import { defineWebSocketHandler } from "h3";

export default defineWebSocketHandler({
  message(peer, message) {
    peer.send(message.text());
  },
});
