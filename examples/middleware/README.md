---
category: features
---

# Middleware

> Request middleware for authentication, logging, and request modification.

## Project Structure

```
middleware/
├── server/
│   └── middleware/
│       └── auth.ts       # Auth middleware
├── server.ts             # Main handler
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

### Defining Middleware

Middleware runs before route handlers. Create files in `server/middleware/`:

```ts [server/middleware/auth.ts]
import { defineMiddleware } from "nitro/h3";

export default defineMiddleware((event) => {
  event.context.auth = {
    name: "User " + Math.round(Math.random() * 100)
  };
});
```

### Accessing Context

Access middleware-added context in your handlers:

```ts [server.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler((event) => ({
  auth: event.context.auth,
}));
```

## Learn More

- [Routing](/docs/routing)
