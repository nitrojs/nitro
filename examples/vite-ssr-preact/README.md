---
category: vite
---

# Vite SSR Preact

> Server-side rendering with Preact and Vite.

## Project Structure

```
vite-ssr-preact/
├── src/
│   ├── app.tsx           # Preact app component
│   ├── entry-client.tsx  # Client hydration entry
│   ├── entry-server.tsx  # Server render entry
│   └── styles.css
├── vite.config.mjs
└── tsconfig.json
```

## How It Works

The server entry streams Preact to HTML:

```tsx [src/entry-server.tsx]
import { renderToReadableStream } from "preact-render-to-string/stream";
import { App } from "./app.jsx";

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const htmlStream = renderToReadableStream(<Root url={url} />);
    return new Response(htmlStream, {
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  },
};
```

## Learn More

- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
