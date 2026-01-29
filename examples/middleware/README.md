---
category: features
icon: i-lucide-layers
defaultFile: server/middleware/auth.ts
---

# Middleware

> Request middleware for authentication, logging, and request modification.

Middleware functions run before route handlers on every request. They can modify the request, add context, or return early responses.

<!-- automd:dir-tree -->

```
├── server/
│   └── middleware/
│       └── auth.ts
├── nitro.config.ts
├── package.json
├── README.md
├── server.ts
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

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
