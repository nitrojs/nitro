---
category: features
---

# Cached Handler

> Cache route responses with configurable bypass logic.

## Project Structure

```
cached-handler/
├── server.ts             # Cached handler
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Use `defineCachedHandler` to cache expensive operations:

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
  {
    shouldBypassCache: ({ req }) => req.url.includes("skipCache=true")
  }
);
```

### Cache Options

- `maxAge` - Cache duration in seconds
- `staleMaxAge` - Stale-while-revalidate duration
- `shouldBypassCache` - Function to conditionally skip cache
- `getKey` - Custom cache key generation

## Learn More

- [Cache](/docs/cache)
- [Storage](/docs/storage)
