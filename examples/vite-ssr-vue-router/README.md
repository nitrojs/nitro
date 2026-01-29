---
category: vite
---

# Vite SSR with Vue Router

> Server-side rendering with Vue Router in Nitro using Vite.

Set up server-side rendering (SSR) with Vue, Vue Router, Vite, and Nitro. This setup enables per-route code splitting, head management with unhead, and client hydration.

<!-- automd:dir-tree -->

```
├── app/
│   ├── pages/
│   │   ├── about.vue
│   │   ├── index.vue
│   │   └── not-found.vue
│   ├── app.vue
│   ├── entry-client.ts
│   ├── entry-server.ts
│   ├── routes.ts
│   ├── shims.d.ts
│   └── styles.css
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.mjs
```

<!-- /automd -->

## Overview

1. Add the Nitro Vite plugin to your Vite config
2. Define routes with lazy-loaded components
3. Create a server entry that renders your app with router support
4. Create a client entry that hydrates and takes over routing
5. Create page components

## 1. Configure Vite

Add the Nitro and Vue plugins to your Vite config. Define both `client` and `ssr` environments:

<!-- automd:file src="vite.config.mjs" code -->

```mjs [vite.config.mjs]
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { nitro } from "nitro/vite";

export default defineConfig((_env) => ({
  plugins: [patchVueExclude(vue(), /\?assets/), devtoolsJson(), nitro()],
  environments: {
    client: { build: { rollupOptions: { input: "./app/entry-client.ts" } } },
    ssr: { build: { rollupOptions: { input: "./app/entry-server.ts" } } },
  },
}));

// Workaround https://github.com/vitejs/vite-plugin-vue/issues/677
function patchVueExclude(plugin, exclude) {
  const original = plugin.transform.handler;
  plugin.transform.handler = function (...args) {
    if (exclude.test(args[1])) return;
    return original.call(this, ...args);
  };
  return plugin;
}
```

<!-- /automd -->

The `patchVueExclude` helper prevents the Vue plugin from processing asset imports (files with `?assets` query parameter).

## 2. Define Routes

Create route definitions with lazy-loaded components and asset metadata:

<!-- automd:file src="app/routes.ts" code -->

```ts [routes.ts]
import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "app",
    component: () => import("./app.vue"),
    meta: {
      assets: () => import("./app.vue?assets"),
    },
    children: [
      {
        path: "/",
        name: "home",
        component: () => import("./pages/index.vue"),
        meta: {
          assets: () => import("./pages/index.vue?assets"),
        },
      },
      {
        path: "/about",
        name: "about",
        component: () => import("./pages/about.vue"),
        meta: {
          assets: () => import("./pages/about.vue?assets"),
        },
      },
      {
        path: "/:catchAll(.*)",
        name: "not-found",
        component: () => import("./pages/not-found.vue"),
        meta: {
          assets: () => import("./pages/not-found.vue?assets"),
        },
      },
    ],
  },
];
```

<!-- /automd -->

Use dynamic imports for lazy-loaded components to enable code splitting. The `meta.assets` function loads route-specific CSS and JS chunks. Define child routes under a root layout component for nested routing.

## 3. Create the Server Entry

The server entry renders your Vue app with router support and head management:

<!-- automd:file src="app/entry-server.ts" code -->

```ts [entry-server.ts]
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import { createHead, transformHtmlTemplate } from "unhead/server";

import { routes } from "./routes.ts";

import clientAssets from "./entry-client.ts?assets=client";

async function handler(request: Request): Promise<Response> {
  const app = createSSRApp(RouterView);
  const router = createRouter({ history: createMemoryHistory(), routes });
  app.use(router);

  const url = new URL(request.url);
  const href = url.href.slice(url.origin.length);

  await router.push(href);
  await router.isReady();

  const assets = clientAssets.merge(
    ...(await Promise.all(
      router.currentRoute.value.matched
        .map((to) => to.meta.assets)
        .filter(Boolean)
        .map((fn) => (fn as any)().then((m: any) => m.default))
    ))
  );

  const head = createHead();

  head.push({
    link: [
      ...assets.css.map((attrs: any) => ({ rel: "stylesheet", ...attrs })),
      ...assets.js.map((attrs: any) => ({ rel: "modulepreload", ...attrs })),
    ],
    script: [{ type: "module", src: clientAssets.entry }],
  });

  const renderedApp = await renderToString(app);

  const html = await transformHtmlTemplate(head, htmlTemplate(renderedApp));

  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=utf-8" },
  });
}

function htmlTemplate(body: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vue Router Custom Framework</title>
</head>
<body>
  <div id="root">${body}</div>
</body>
</html>`;
}

export default {
  fetch: handler,
};
```

<!-- /automd -->

The server uses `createMemoryHistory()` since there's no browser URL bar—the router navigates to the requested URL before rendering. Assets are loaded dynamically based on matched routes, ensuring only the CSS and JS needed for the current page are included. The `unhead` library manages `<head>` elements, injecting stylesheets and scripts via `transformHtmlTemplate`.

## 4. Create the Client Entry

The client entry hydrates the server-rendered HTML and takes over routing:

<!-- automd:file src="app/entry-client.ts" code -->

```ts [entry-client.ts]
import { createSSRApp } from "vue";
import { RouterView, createRouter, createWebHistory } from "vue-router";
import { routes } from "./routes.ts";

async function main() {
  const app = createSSRApp(RouterView);
  const router = createRouter({ history: createWebHistory(), routes });
  app.use(router);

  await router.isReady();
  app.mount("#root");
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main();
```

<!-- /automd -->

The client entry creates a Vue app with `createWebHistory()` for browser-based routing. After the router is ready, it mounts to the `#root` element and hydrates the server-rendered HTML.

## 5. Create the Root Component

The root component provides navigation and renders child routes:

<!-- automd:file src="app/app.vue" code lang="vue" -->

```vue [app.vue]
<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import "./styles.css";
</script>

<template>
  <nav>
    <ul>
      <li>
        <RouterLink to="/" exact-active-class="active">Home</RouterLink>
      </li>
      <li>
        <RouterLink to="/about" active-class="active">About</RouterLink>
      </li>
    </ul>
  </nav>
  <RouterView />
</template>

<style scoped>
nav {
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1rem;
}

nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

nav a {
  color: #666;
  text-decoration: none;
}

nav a:hover {
  color: #333;
}

nav a.active {
  color: #646cff;
}
</style>
```

<!-- /automd -->

## Learn More

- [Vue Router Documentation](https://router.vuejs.org/)
- [Unhead Documentation](https://unhead.unjs.io/)
- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
