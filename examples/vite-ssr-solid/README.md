---
category: vite
---

# Vite SSR Solid

> Server-side rendering with SolidJS and Vite.

## Project Structure

```
vite-ssr-solid/
├── src/
│   ├── app.tsx           # Solid app component
│   ├── entry-client.tsx  # Client hydration entry
│   ├── entry-server.tsx  # Server render entry
│   └── styles.css
├── vite.config.mjs
└── tsconfig.json
```

## How It Works

The server entry renders Solid with hydration support:

```tsx [src/entry-server.tsx]
import { renderToStringAsync, HydrationScript } from "solid-js/web";
import { App } from "./app.jsx";

export default {
  async fetch(req: Request): Promise<Response> {
    const appHTML = await renderToStringAsync(() => <App />);
    return new Response(htmlTemplate(appHTML), {
      headers: { "Content-Type": "text/html" },
    });
  },
};
```

## Learn More

- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
