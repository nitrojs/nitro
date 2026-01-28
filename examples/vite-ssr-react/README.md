---
category: vite
---

# Vite SSR React

> Server-side rendering with React and Vite.

## Project Structure

```
vite-ssr-react/
├── src/
│   ├── app.tsx           # React app component
│   ├── entry-client.tsx  # Client hydration entry
│   ├── entry-server.tsx  # Server render entry
│   └── styles.css
├── vite.config.mjs
└── tsconfig.json
```

## How It Works

The server entry renders React to a readable stream:

```tsx [src/entry-server.tsx]
import { renderToReadableStream } from "react-dom/server.edge";
import { App } from "./app.tsx";

export default {
  async fetch(_req: Request) {
    return new Response(
      await renderToReadableStream(
        <html lang="en">
          <body id="app">
            <App />
          </body>
        </html>
      ),
      { headers: { "Content-Type": "text/html;charset=utf-8" } }
    );
  },
};
```

## Learn More

- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
