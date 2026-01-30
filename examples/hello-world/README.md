---
category: features
icon: i-lucide-sparkles
---

# Hello World

> Minimal Nitro server using the web standard fetch handler.

<!-- automd:ui-code-tree src="." default="server.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="server.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "build": "nitro build",
    "dev": "nitro dev",
    "preview": "node .output/server/index.mjs"
  },
  "devDependencies": {
    "nitro": "latest"
  }
}
```

```ts [server.ts]
export default {
  fetch(req: Request) {
    return new Response("Nitro Works!");
  },
};
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

::

<!-- /automd -->

The simplest Nitro server. Export an object with a `fetch` method that receives a standard `Request` and returns a `Response`. No frameworks, no abstractions, just the web platform.


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


<!-- /automd -->

Add the Nitro plugin to Vite and it handles the rest: dev server, hot reloading, and production builds.

## Learn More

- [Server Entry](/docs/server-entry)
- [Configuration](/docs/configuration)
