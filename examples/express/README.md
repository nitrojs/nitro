---
category: backend frameworks
icon: i-simple-icons-express
defaultFile: server.node.ts
---

# Express

> Integrate Express with Nitro using the server entry.

<!-- automd:dir-tree -->

```
├── nitro.config.ts
├── package.json
├── README.md
├── server.node.ts
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Server Entry

<!-- automd:file src="server.node.ts" code -->

```ts [server.node.ts]
import Express from "express";

const app = Express();

app.use("/", (_req, res) => {
  res.send("Hello from Express with Nitro!");
});

export default app;
```

<!-- /automd -->

Nitro auto-detects `server.node.ts` in your project root and uses it as the server entry. The Express app handles all incoming requests, giving you full control over routing and middleware.

::note
The `.node.ts` suffix indicates this entry is Node.js specific and won't work in other runtimes like Cloudflare Workers or Deno.
::

## Learn More

- [Server Entry](/docs/server-entry)
- [Express Documentation](https://expressjs.com/)
