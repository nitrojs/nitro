## Server Entry

```ts [server.ts]
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello, Hono with Nitro!");
});

export default app;
```

Nitro auto-detects `server.ts` in your project root and uses it as the server entry. The Hono app handles all incoming requests, giving you full control over routing and middleware.

Hono is cross-runtime compatible, so this server entry works across all Nitro deployment targets including Node.js, Deno, Bun, and Cloudflare Workers.
