import { defineWebSocketHandler } from "nitro";

export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe("chat");
    peer.send("ready");
  },
  message(peer, message) {
    // Name of the Durable Object instance handling the peer (crossws internals)
    if (message.text() === "instance") {
      peer.send(`instance:${(peer as any)._internal.durable?.ctx.id.name}`);
      return;
    }
    peer.publish("chat", `pub:${message.text()}`);
    peer.send("sent");
  },
});
