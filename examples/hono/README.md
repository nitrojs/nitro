---
category: backend frameworks
icon: i-logos-hono
defaultFile: server.ts
---

# Hono

> Integrate Hono with Nitro using the server entry.

<!-- automd:dir-tree -->

```
├── nitro.config.ts
├── package.json
├── README.md
├── server.ts
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Server Entry

<!-- automd:file src="server.ts" code -->

```ts [server.ts]
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello, Hono with Nitro!");
});

export default app;
```

<!-- /automd -->

Nitro auto-detects `server.ts` in your project root and uses it as the server entry. The Hono app handles all incoming requests, giving you full control over routing and middleware.

Hono is cross-runtime compatible, so this server entry works across all Nitro deployment targets including Node.js, Deno, Bun, and Cloudflare Workers.

## Learn More

- [Server Entry](/docs/server-entry)
- [Hono Documentation](https://hono.dev/)
