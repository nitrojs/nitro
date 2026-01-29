---
category: features
icon: i-lucide-sparkles
defaultFile: server.ts
---

# Hello World

> Minimal Nitro server using the web standard fetch handler.

The simplest Nitro server. Export an object with a `fetch` method that receives a standard `Request` and returns a `Response`. No frameworks, no abstractions, just the web platform.

<!-- automd:dir-tree -->

```
├── nitro.config.ts
├── package.json
├── README.md
├── server.ts
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Server Entry

<!-- automd:file src="server.ts" code -->

```ts [server.ts]
export default {
  fetch(req: Request) {
    return new Response("Nitro Works!");
  },
};
```

<!-- /automd -->

The `fetch` method follows the same signature as Service Workers and Cloudflare Workers. This pattern works across all deployment targets because it uses web standards.

## Vite Integration

<!-- automd:file src="vite.config.ts" code -->

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

<!-- /automd -->

Add the Nitro plugin to Vite and it handles the rest: dev server, hot reloading, and production builds.

## Learn More

- [Server Entry](/docs/server-entry)
- [Configuration](/docs/configuration)
