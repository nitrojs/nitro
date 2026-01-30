---
category: features
icon: i-lucide-layers
---

# Middleware

> Request middleware for authentication, logging, and request modification.

<!-- automd:ui-code-tree src="." default="server/middleware/auth.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="server/middleware/auth.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: true,
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build"
  },
  "devDependencies": {
    "nitro": "latest"
  }
}
```

```ts [server.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler((event) => ({
  auth: event.context.auth,
}));
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

```ts [server/middleware/auth.ts]
import { defineMiddleware } from "nitro/h3";

export default defineMiddleware((event) => {
  event.context.auth = { name: "User " + Math.round(Math.random() * 100) };
});
```

::

<!-- /automd -->

Middleware functions run before route handlers on every request. They can modify the request, add context, or return early responses.

## Defining Middleware

Create files in `server/middleware/`. They run in alphabetical order:

<!-- automd:file src="server/middleware/auth.ts" code -->

```ts [auth.ts]
import { defineMiddleware } from "nitro/h3";

export default defineMiddleware((event) => {
  event.context.auth = { name: "User " + Math.round(Math.random() * 100) };
});
```

<!-- /automd -->

Middleware can:
- Add data to `event.context` for use in handlers
- Return a response early to short-circuit the request
- Modify request headers or other properties

## Accessing Context in Handlers

Data added to `event.context` in middleware is available in all subsequent handlers:

<!-- automd:file src="server.ts" code -->

```ts [server.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler((event) => ({
  auth: event.context.auth,
}));
```

<!-- /automd -->

## Learn More

- [Routing](/docs/routing)
