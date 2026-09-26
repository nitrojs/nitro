import { defineWebSocketHandler } from "h3";

export default defineWebSocketHandler({
  open(peer) {
    peer.send("connected");
  },
  message(peer, message) {
    if (message.text() === "ping") {
      peer.send("pong");
    } else {
      peer.send(`echo:${message.text()}`);
    }
  },
});
