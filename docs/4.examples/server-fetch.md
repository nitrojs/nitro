---
category: features
icon: i-lucide-arrow-right-left
---

# Server Fetch

> Internal server-to-server requests without network overhead.

<!-- automd:ui-code-tree src="../../examples/server-fetch" default="routes/index.ts" ignore="README.md,GUIDE.md" expandAll -->

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
  "extends": "nitro/tsconfig",
  "include": ["./node_modules/.nitro/types/nitro.d.ts", "./**/*"]
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

```ts [routes/hello.ts]
import { defineHandler } from "nitro";

export default defineHandler(() => "Hello!");
```

```ts [routes/index.ts]
import { defineHandler, serverFetch } from "nitro";

export default defineHandler(() => serverFetch("/hello"));
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/server-fetch/README.md" -->

When you need one route to call another, use Nitro's `serverFetch` function. It makes internal requests that stay in-process, avoiding network round-trips. The request never leaves the server.

## Main Route

```ts [routes/index.ts]
import { defineHandler, serverFetch } from "nitro";

export default defineHandler(() => serverFetch("/hello"));
```

The index route imports `serverFetch` from `nitro` and calls the `/hello` route. This request is handled internally without going through the network stack.

## Internal API Route

```ts [routes/hello.ts]
import { defineHandler } from "nitro";

export default defineHandler(() => "Hello!");
```

A simple route that returns "Hello!". When the index route calls `serverFetch("/hello")`, this handler runs and its response is returned directly.

<!-- /automd -->

## Type Safety

`serverFetch` supports type safety for your generated routes. To enable route types, add `node_modules/.nitro/types/nitro.d.ts` to your `tsconfig.json`:

```json
{
  "extends": "nitro/tsconfig",
  "include": ["./node_modules/.nitro/types/nitro.d.ts", "./**/*"]
}
```

Once the generated declarations are included, known paths are autocompleted, the `method` option is narrowed to the methods a route actually handles, and the response body is inferred from the route handler.

In this example, `serverFetch("/hello")` returns a typed response whose JSON body is inferred as `string`:

```ts
const res = await serverFetch("/hello"); // path autocompleted
const data = await res.json();           // string
```

Dynamic paths can also be typed when TypeScript can match them to a generated route pattern.

## `fetch` helper

Nitro also exports a `fetch` helper. It is fetch-compatible and can call relative Nitro routes through the same internal server fetch mechanism, while still supporting regular external requests. Prefer `serverFetch` when you are intentionally calling a known Nitro route and want generated route types. Use `fetch` when the code should keep the broader Fetch API shape, for example when the request target can be either internal or external.

## Learn More

- [Routing](/docs/routing)
