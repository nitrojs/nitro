import { defineHandler, defineWebSocketHandler } from "nitro";

const ws = defineWebSocketHandler({
  open(peer) {
    peer.send("ready");
  },
});

export default defineHandler(async (event) => {
  await ws(event);
  return new Response("Forbidden", { status: 403 });
});
