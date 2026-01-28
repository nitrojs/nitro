---
category: features
---

# Server Fetch

> Internal server-to-server requests without network overhead.

## Project Structure

```
server-fetch/
├── routes/
│   ├── index.ts          # Main route using server fetch
│   └── hello.ts          # Internal API route
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Use the `fetch` function from `nitro` to make internal requests:

```ts [routes/index.ts]
import { defineHandler } from "nitro/h3";
import { fetch } from "nitro";

export default defineHandler(() => fetch("/hello"));
```

```ts [routes/hello.ts]
export default () => "Hello from internal route!";
```

## Learn More

- [Routing](/docs/routing)
