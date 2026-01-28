---
category: features
---

# WebSocket

> Real-time bidirectional communication with WebSocket support.

## Project Structure

```
websocket/
├── routes/
│   └── _ws.ts            # WebSocket handler
├── index.html            # Client demo
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Define a WebSocket handler using `defineWebSocketHandler`:

```ts [routes/_ws.ts]
import { defineWebSocketHandler } from "nitro/h3";

export default defineWebSocketHandler({
  open(peer) {
    peer.send({ user: "server", message: `Welcome ${peer}!` });
    peer.publish("chat", { user: "server", message: `${peer} joined!` });
    peer.subscribe("chat");
  },

  message(peer, message) {
    if (message.text().includes("ping")) {
      peer.send({ user: "server", message: "pong" });
    } else {
      const msg = { user: peer.toString(), message: message.toString() };
      peer.send(msg);
      peer.publish("chat", msg);
    }
  },

  close(peer) {
    peer.publish("chat", { user: "server", message: `${peer} left!` });
  },
});
```

## Learn More

- [Routing](/docs/routing)
