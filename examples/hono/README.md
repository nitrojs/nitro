---
category: backend frameworks
icon: i-logos-hono
---

# Hono

> Integrate Hono with Nitro using the server entry.

<!-- automd:ui-code-tree src="." default="server.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="server.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "build": "nitro build",
    "dev": "nitro dev"
  },
  "devDependencies": {
    "hono": "^4.11.7",
    "nitro": "latest"
  }
}
```

```ts [server.ts]
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello, Hono with Nitro!");
});

export default app;
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

::

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
