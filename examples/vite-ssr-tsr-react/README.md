---
category: vite
---

# Vite SSR TanStack Router

> Server-side rendering with TanStack Router and React.

## Project Structure

```
vite-ssr-tsr-react/
├── src/
│   ├── main.tsx          # App entry with router
│   ├── routes/
│   │   ├── __root.tsx    # Root layout
│   │   └── index.tsx     # Home route
│   ├── routeTree.gen.ts  # Generated route tree
│   └── assets/
│       └── main.css
├── index.html
├── vite.config.mjs
└── tsconfig.json
```

## How It Works

Create a router with the generated route tree:

```tsx [src/main.tsx]
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

## Learn More

- [TanStack Router Documentation](https://tanstack.com/router)
- [Renderer](/docs/renderer)
