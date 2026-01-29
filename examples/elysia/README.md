---
category: framework
---

# Elysia

> Integrate Elysia with Nitro using the server entry.

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
import { Elysia } from "elysia";

const app = new Elysia();

app.get("/", () => "Hello, Elysia with Nitro!");

export default app.compile();
```

<!-- /automd -->

Nitro auto-detects `server.ts` in your project root and uses it as the server entry. The Elysia app handles all incoming requests, giving you full control over routing and middleware.

Call `app.compile()` before exporting to optimize the router for production.

## Learn More

- [Server Entry](/docs/server-entry)
- [Elysia Documentation](https://elysiajs.com/)
