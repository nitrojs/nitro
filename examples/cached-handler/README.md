---
category: features
icon: i-lucide-clock
---

# Cached Handler

> Cache route responses with configurable bypass logic.

<!-- automd:ui-code-tree src="." default="server.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({});
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

```ts [server.ts]
import { html } from "nitro/h3";
import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return html`
      Response generated at ${new Date().toISOString()} (took 500ms)
      <br />(<a href="?skipCache=true">skip cache</a>)
    `;
  },
  { shouldBypassCache: ({ req }) => req.url.includes("skipCache=true") }
);
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

<!-- automd:file src="GUIDE.md" -->

This example shows how to cache an expensive operation (a 500 ms delay) and conditionally bypass the cache using a query parameter. On first request, the handler executes and caches the result. Subsequent requests return the cached response instantly until the cache expires or is bypassed.

## How It Works

```ts [server.ts]
import { html } from "nitro/h3";
import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return html`
      Response generated at ${new Date().toISOString()} (took 500ms)
      <br />(<a href="?skipCache=true">skip cache</a>)
    `;
  },
  { shouldBypassCache: ({ req }) => req.url.includes("skipCache=true") }
);
```

The handler simulates a slow operation with a 500ms delay. As `defineCachedHandler` wraps it, the response is cached after the first execution. The `shouldBypassCache` option checks for `?skipCache=true` in the URL and when present the cache is skipped and the handler runs fresh.

<!-- /automd -->

## Learn More

- [Cache](/docs/cache)
- [Storage](/docs/storage)
