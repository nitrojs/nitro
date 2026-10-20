import { defineWebSocketHandler } from "nitro";

export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe("chat");
    peer.send("ready");
  },
  message(peer, message) {
    peer.publish("chat", `pub:${message.text()}`);
    peer.send("sent");
  },
});
