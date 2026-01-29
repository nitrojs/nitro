---
category: features
---

# API Routes

> File-based API routing with HTTP method support and dynamic parameters.

Nitro supports file-based routing in the `api/` or `routes/` directory. Each file becomes an API endpoint based on its path.

<!-- automd:dir-tree -->

```
├── api/
│   ├── hello/
│   │   └── [name].ts
│   ├── hello.ts
│   ├── test.get.ts
│   └── test.post.ts
├── index.html
├── nitro.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Basic Route

Create a file in the `api/` directory to define a route. The file path becomes the URL path:

<!-- automd:file src="api/hello.ts" code -->

```ts [hello.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler(() => "Nitro is amazing!");
```

<!-- /automd -->

This creates a `GET /api/hello` endpoint.

## Dynamic Routes

Use square brackets `[param]` for dynamic URL segments. Access params via `event.context.params`:

<!-- automd:file src="api/hello/[name].ts" code -->

```ts [[name].ts]
import { defineHandler } from "nitro/h3";

export default defineHandler((event) => `Hello (param: ${event.context.params!.name})!`);
```

<!-- /automd -->

This creates a `GET /api/hello/:name` endpoint (e.g., `/api/hello/world`).

## HTTP Methods

Suffix your file with the HTTP method (`.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`, etc.):

### GET Handler

<!-- automd:file src="api/test.get.ts" code -->

```ts [test.get.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler(() => "Test get handler");
```

<!-- /automd -->

### POST Handler

<!-- automd:file src="api/test.post.ts" code -->

```ts [test.post.ts]
import { defineHandler } from "h3";

export default defineHandler(async (event) => {
  const body = await event.req.json();
  return {
    message: "Test post handler",
    body,
  };
});
```

<!-- /automd -->

## Learn More

- [Routing](/docs/routing)
