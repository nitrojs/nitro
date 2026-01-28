---
category: vite
---

# Vite SSR Vue Router

> Server-side rendering with Vue and Vue Router.

## Project Structure

```
vite-ssr-vue-router/
├── app/
│   ├── app.vue           # Root Vue component
│   ├── entry-client.ts   # Client hydration entry
│   ├── entry-server.ts   # Server render entry
│   ├── routes.ts         # Route definitions
│   ├── pages/
│   │   ├── index.vue
│   │   ├── about.vue
│   │   └── not-found.vue
│   └── styles.css
├── vite.config.mjs
└── tsconfig.json
```

## How It Works

The server entry sets up Vue Router with memory history:

```ts [app/entry-server.ts]
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import { routes } from "./routes.ts";

async function handler(request: Request): Promise<Response> {
  const app = createSSRApp(RouterView);
  const router = createRouter({ history: createMemoryHistory(), routes });
  app.use(router);

  await router.push(href);
  await router.isReady();

  const html = await renderToString(app);
  return new Response(htmlTemplate(html), {
    headers: { "Content-Type": "text/html;charset=utf-8" },
  });
}

export default { fetch: handler };
```

## Learn More

- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
