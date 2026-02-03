## Server Entry

```ts [server.ts]
import { Elysia } from "elysia";

const app = new Elysia();

app.get("/", () => "Hello, Elysia with Nitro!");

export default app.compile();
```

Nitro auto-detects `server.ts` in your project root and uses it as the server entry. The Elysia app handles all incoming requests, giving you full control over routing and middleware.

Call `app.compile()` before exporting to optimize the router for production.
