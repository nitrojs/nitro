---
category: features
icon: i-lucide-radio
defaultFile: routes/_ws.ts
---

# WebSocket

> Real-time bidirectional communication with WebSocket support.

This example implements a simple chat room using WebSockets. Clients connect, send messages, and receive messages from other users in real-time. The server broadcasts messages to all connected clients using pub/sub channels.

<!-- automd:dir-tree -->

```
├── routes/
│   └── _ws.ts
├── index.html
├── nitro.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## WebSocket Handler

Create a WebSocket route using `defineWebSocketHandler`.

<!-- automd:file src="routes/_ws.ts" code -->

```ts [_ws.ts]
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
      const msg = {
        user: peer.toString(),
        message: message.toString(),
      };
      peer.send(msg); // echo
      peer.publish("chat", msg);
    }
  },
  close(peer) {
    peer.publish("chat", { user: "server", message: `${peer} left!` });
  },
});
```

<!-- /automd -->

Different hooks are exposed by `defineWebSocketHandler()` to integrate with different parts of the websocket lifecycle.

## Learn More

- [Routing](/docs/routing)
- [crossws Documentation](https://crossws.h3.dev/guide/hooks)
