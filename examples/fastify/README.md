---
category: framework
---

# Fastify

> Use Fastify with Nitro.

## Project Structure

```
fastify/
├── server.node.ts        # Fastify app (Node.js specific)
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Create a Fastify app and export the routing handler:

```ts [server.node.ts]
import Fastify from "fastify";

const app = Fastify();

app.get("/", () => "Hello, Fastify with Nitro!");

await app.ready();

export default app.routing;
```

::note
The `.node.ts` suffix indicates this entry is Node.js specific.
::

## Learn More

- [Fastify Documentation](https://fastify.dev/)
