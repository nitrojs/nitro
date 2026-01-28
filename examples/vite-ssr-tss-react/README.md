---
category: vite
---

# Vite SSR TanStack Start

> Full-stack React with TanStack Start and Nitro.

## Project Structure

```
vite-ssr-tss-react/
├── src/
│   ├── router.tsx        # Router configuration
│   ├── routes/
│   │   ├── __root.tsx    # Root layout
│   │   ├── index.tsx     # Home route
│   │   └── api/          # API routes
│   ├── routeTree.gen.ts  # Generated routes
│   └── styles/
│       └── app.css
├── server.ts             # Nitro server entry
├── vite.config.mjs
└── tsconfig.json
```

## How It Works

Integrate TanStack Start with Nitro:

```ts [server.ts]
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
```

## Learn More

- [TanStack Start Documentation](https://tanstack.com/start)
- [Server Entry](/docs/server-entry)
