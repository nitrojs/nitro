---
category: features
---

# API Routes

> File-based API routing with HTTP method support and dynamic parameters.

## Project Structure

```
api-routes/
├── api/
│   ├── hello.ts          # GET /api/hello
│   ├── hello/
│   │   └── [name].ts     # GET /api/hello/:name (dynamic route)
│   ├── test.get.ts       # GET /api/test
│   └── test.post.ts      # POST /api/test
├── index.html
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

### Basic Route

Create a file in the `api/` directory to define a route:

```ts [api/hello.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler(() => "Nitro is amazing!");
```

### Dynamic Routes

Use square brackets for dynamic segments:

```ts [api/hello/[name].ts]
import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  return `Hello ${event.context.params!.name}!`;
});
```

### HTTP Methods

Suffix your file with the HTTP method:

```ts [api/test.get.ts]
export default defineHandler(() => "Test get handler");
```

```ts [api/test.post.ts]
export default defineHandler(async (event) => {
  const body = await event.req.json();
  return { message: "Test post handler", body };
});
```

## Learn More

- [Routing](/docs/routing)
