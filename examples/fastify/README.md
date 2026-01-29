---
category: backend frameworks
icon: i-simple-icons-fastify
defaultFile: server.node.ts
---

# Fastify

> Integrate Fastify with Nitro using the server entry.

<!-- automd:dir-tree -->

```
├── nitro.config.ts
├── package.json
├── README.md
├── server.node.ts
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Server Entry

<!-- automd:file src="server.node.ts" code -->

```ts [server.node.ts]
import Fastify from "fastify";

const app = Fastify();

app.get("/", () => "Hello, Fastify with Nitro!");

await app.ready();

export default app.routing;
```

<!-- /automd -->

Nitro auto-detects `server.node.ts` in your project root and uses it as the server entry.

Call `await app.ready()` to initialize all registered plugins before exporting. Export `app.routing` (not `app`) to provide Nitro with the request handler function.

::note
The `.node.ts` suffix indicates this entry is Node.js specific and won't work in other runtimes like Cloudflare Workers or Deno.
::

## Learn More

- [Server Entry](/docs/server-entry)
- [Fastify Documentation](https://fastify.dev/)
