---
category: server side rendering
icon: i-lucide-code
---

# Custom Renderer

> Build a custom HTML renderer in Nitro with server-side data fetching.

<!-- automd:ui-code-tree src="." default="renderer.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="renderer.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  renderer: { handler: "./renderer" },
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

```ts [renderer.ts]
import { fetch } from "nitro";

export default async function renderer({ url }: { req: Request; url: URL }) {
  const apiRes = await fetch("/api/hello").then((res) => res.text());
  return new Response(
    /* html */ `<!DOCTYPE html>
    <html>
    <head>
      <title>Custom Renderer</title>
    </head>
    <body>
      <h1>Hello from custom renderer!</h1>
      <p>Current path: ${url.pathname}</p>
      <p>API says: ${apiRes}</p>
    </body>
    </html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
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

::

<!-- /automd -->

Create a custom renderer that generates HTML responses with data from API routes. Use Nitro's internal `fetch` to call routes without network overhead.

## Renderer

<!-- automd:file src="renderer.ts" code -->

```ts [renderer.ts]
import { fetch } from "nitro";

export default async function renderer({ url }: { req: Request; url: URL }) {
  const apiRes = await fetch("/api/hello").then((res) => res.text());
  return new Response(
    /* html */ `<!DOCTYPE html>
    <html>
    <head>
      <title>Custom Renderer</title>
    </head>
    <body>
      <h1>Hello from custom renderer!</h1>
      <p>Current path: ${url.pathname}</p>
      <p>API says: ${apiRes}</p>
    </body>
    </html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
```

<!-- /automd -->

Nitro auto-detects `renderer.ts` in your project root and uses it for all non-API routes. The renderer function receives the request URL and returns a `Response`.

Use `fetch` from `nitro` to call API routes without network overhead—these requests stay in-process.

## API Route

<!-- automd:file src="api/hello.ts" code -->

```ts [hello.ts]
import { defineHandler } from "nitro/h3";

export default defineHandler(() => "Nitro is amazing!");
```

<!-- /automd -->

Define API routes in the `api/` directory. When the renderer calls `fetch("/api/hello")`, this handler runs and returns its response.

## Learn More

- [Renderer](/docs/renderer)
