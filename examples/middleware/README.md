Middleware functions run before route handlers on every request. They can modify the request, add context, or return early responses.

## Defining Middleware

Create files in `server/middleware/`. They run in alphabetical order:

```ts [server/middleware/auth.ts]
import { defineMiddleware } from "nitro/h3";

export default defineMiddleware((event) => {
  event.context.auth = { name: "User " + Math.round(Math.random() * 100) };
});
```

Middleware can:
- Add data to `event.context` for use in handlers
- Return a response early to short-circuit the request
- Modify request headers or other properties

## Accessing Context in Handlers

Data added to `event.context` in middleware is available in all subsequent handlers:

```ts [server.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler((event) => ({
  auth: event.context.auth,
}));
```
