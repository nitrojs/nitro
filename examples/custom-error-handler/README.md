---
category: features
---

# Custom Error Handler

> Customize error responses with a global error handler.

## Project Structure

```
custom-error-handler/
├── error.ts              # Custom error handler
├── server.ts             # Main handler
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Create an `error.ts` file to customize error responses:

```ts [error.ts]
import { defineErrorHandler } from "nitro";

export default defineErrorHandler((error, _event) => {
  return new Response(`Custom Error Handler: ${error.message}`, {
    status: 500,
    headers: { "Content-Type": "text/plain" },
  });
});
```

The error handler receives:
- `error` - The error that was thrown
- `event` - The H3 event object

## Learn More

- [Server Entry](/docs/server-entry)
