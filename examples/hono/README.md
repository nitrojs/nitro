---
category: framework
---

# Hono

> Use Hono with Nitro.

## Project Structure

```
hono/
├── server.ts             # Hono app
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Create a Hono app and export it as the default handler:

```ts [server.ts]
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello, Hono with Nitro!");
});

export default app;
```

## Learn More

- [Hono Documentation](https://hono.dev/)
