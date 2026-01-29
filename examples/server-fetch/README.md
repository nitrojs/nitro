---
category: features
---

# Server Fetch

> Internal server-to-server requests without network overhead.

When you need one route to call another, use Nitro's `fetch` function instead of the global fetch. It makes internal requests that stay in-process, avoiding network round-trips. The request never leaves the server.

<!-- automd:dir-tree -->

```
├── routes/
│   ├── hello.ts
│   └── index.ts
├── nitro.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

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
