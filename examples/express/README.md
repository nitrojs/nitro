## Server Entry

```ts [server.node.ts]
import Express from "express";

const app = Express();

app.use("/", (_req, res) => {
  res.send("Hello from Express with Nitro!");
});

export default app;
```

Nitro auto-detects `server.node.ts` in your project root and uses it as the server entry. The Express app handles all incoming requests, giving you full control over routing and middleware.

::note
The `.node.ts` suffix indicates this entry is Node.js specific and won't work in other runtimes like Cloudflare Workers or Deno.
::
