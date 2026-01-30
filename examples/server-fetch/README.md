---
category: features
icon: i-lucide-arrow-right-left
---

# Server Fetch

> Internal server-to-server requests without network overhead.

<!-- automd:ui-code-tree src="." default="routes/index.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="routes/index.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig, serverFetch } from "nitro";

export default defineConfig({
  serverDir: "./",
  hooks: {
    "dev:start": async () => {
      const res = await serverFetch("/hello");
      const text = await res.text();
      console.log("Fetched /hello in nitro module:", res.status, text);
    },
  },
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build"
  },
  "devDependencies": {
    "nitro": "latest"
  }
}
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

```ts [routes/hello.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler(() => "Hello!");
```

```ts [routes/index.ts]
import { defineHandler } from "nitro/h3";
import { fetch } from "nitro";

export default defineHandler(() => fetch("/hello"));
```

::

<!-- /automd -->

When you need one route to call another, use Nitro's `fetch` function instead of the global fetch. It makes internal requests that stay in-process, avoiding network round-trips. The request never leaves the server.

## Main Route

<!-- automd:file src="routes/index.ts" code -->

```ts [index.ts]
import { defineHandler } from "nitro/h3";
import { fetch } from "nitro";

export default defineHandler(() => fetch("/hello"));
```

<!-- /automd -->

The index route imports `fetch` from `nitro` (not the global fetch) and calls the `/hello` route. This request is handled internally without going through the network stack.

## Internal API Route

<!-- automd:file src="routes/hello.ts" code -->

```ts [hello.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler(() => "Hello!");
```

<!-- /automd -->

A simple route that returns "Hello!". When the index route calls `fetch("/hello")`, this handler runs and its response is returned directly.

## Learn More

- [Routing](/docs/routing)
