import { DurableObject } from "cloudflare:workers";
import { condition } from "#runtime-condition";

export class Counter extends DurableObject {
  override async fetch(request: Request) {
    if (request.headers.get("upgrade") === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    const { searchParams } = new URL(request.url);
    if (searchParams.has("condition")) {
      return Response.json({ condition });
    }
    let count = (await this.ctx.storage.get<number>("count")) || 0;
    if (searchParams.has("increment")) {
      await this.ctx.storage.put("count", ++count);
    }
    return Response.json({ count });
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    ws.send(`echo:${message}`);
  }
}
