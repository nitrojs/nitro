---
category: framework
---

# Elysia

> Use Elysia framework with Nitro.

## Project Structure

```
elysia/
├── server.ts             # Elysia app
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Create an Elysia app and export the compiled handler:

```ts [server.ts]
import { Elysia } from "elysia";

const app = new Elysia();

app.get("/", () => "Hello, Elysia with Nitro!");

export default app.compile();
```

## Learn More

- [Elysia Documentation](https://elysiajs.com/)
