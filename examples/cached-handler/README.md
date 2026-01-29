---
category: features
icon: i-lucide-clock
defaultFile: server.ts
---

# Cached Handler

> Cache route responses with configurable bypass logic.

This example shows how to cache an expensive operation (a 500 ms delay) and conditionally bypass the cache using a query parameter. On first request, the handler executes and caches the result. Subsequent requests return the cached response instantly until the cache expires or is bypassed.

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

## How It Works

<!-- automd:file src="server.ts" code -->

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

<!-- /automd -->

The handler simulates a slow operation with a 500ms delay. As `defineCachedHandler` wraps it, the response is cached after the first execution. The `shouldBypassCache` option checks for `?skipCache=true` in the URL and when present the cache is skipped and the handler runs fresh.

## Learn More

- [Cache](/docs/cache)
- [Storage](/docs/storage)
