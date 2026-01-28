---
category: rendering
---

# Custom Renderer

> Build a custom HTML renderer with server-side data fetching.

## Project Structure

```
renderer/
├── api/
│   └── hello.ts          # API route
├── renderer.ts           # Custom renderer
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Create a custom renderer that generates HTML:

```ts [renderer.ts]
import { fetch } from "nitro";

export default async function renderer({ url }: { req: Request; url: URL }) {
  const apiRes = await fetch("/api/hello").then((res) => res.text());

  return new Response(
    `<!DOCTYPE html>
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

## Learn More

- [Renderer](/docs/renderer)
