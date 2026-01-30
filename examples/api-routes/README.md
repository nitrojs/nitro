---
category: features
icon: i-lucide-route
---

# API Routes

> File-based API routing with HTTP method support and dynamic parameters.

<!-- automd:ui-code-tree src="." default="api/hello.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="api/hello.ts" expandAll}

```html [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>API Routes</title>
  </head>
  <body>
    <h2>API Routes:</h2>
    <ul>
      <li><a href="/api/hello">/api/hello</a></li>
      <li><a href="/api/hello/world">/api/hello/world</a></li>
      <li><a href="/api/test">/api/test</a></li>
    </ul>
  </body>
</html>
```

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
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
  "extends": "nitro/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

```ts [api/hello.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler(() => "Nitro is amazing!");
```

```ts [api/test.get.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler(() => "Test get handler");
```

```ts [api/test.post.ts]
import { defineHandler } from "h3";

export default defineHandler(async (event) => {
  const body = await event.req.json();
  return {
    message: "Test post handler",
    body,
  };
});
```

```ts [api/hello/[name].ts]
import { defineHandler } from "nitro/h3";

export default defineHandler((event) => `Hello (param: ${event.context.params!.name})!`);
```

::

<!-- /automd -->

Nitro supports file-based routing in the `api/` or `routes/` directory. Each file becomes an API endpoint based on its path.

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
