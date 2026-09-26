export default defineWebSocketHandler({
  message(peer, message) {
    peer.send(message.text());
  },
});
