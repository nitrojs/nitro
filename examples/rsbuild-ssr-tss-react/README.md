Set up [TanStack Start](https://tanstack.com/start) on [Rsbuild](https://rsbuild.rs) with Nitro, using the experimental `nitro/rsbuild` plugin: server-side rendering, file-based routing, server functions and API routes.

## Overview

1. Add the React, TanStack Start and Nitro plugins to your Rsbuild config
2. Create a server entry using TanStack Start's server handler
3. Configure the router with default components
4. Define routes, server functions and API endpoints using file-based routing

## 1. Configure Rsbuild

```ts [rsbuild.config.ts]
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { nitro } from "nitro/rsbuild";

export default defineConfig({
  plugins: [
    pluginReact(),
    // Nitro serves the `ssr` environment (pages, server functions and server routes)
    tanstackStart({ rsbuild: { installDevServerMiddleware: false } }),
    nitro(),
  ],
});
```

The `tanstackStart()` plugin adds the `client` and `ssr` Rsbuild environments. Nitro serves the client assets and uses the `ssr` environment as its renderer, in development and in production.

Set `rsbuild.installDevServerMiddleware: false`: in development, Nitro handles all requests to the `ssr` environment, including server function calls (`/_serverFn/*`), instead of the dev middleware of TanStack Start.

## 2. Create the Server Entry

```ts [src/server.ts]
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
```

TanStack Start uses `src/server.ts` as the entry of the `ssr` environment. Its `fetch` handler renders pages, and handles server functions and API routes.

## 3. Configure the Router

```tsx [src/router.tsx]
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultErrorComponent: () => <div>Internal Server Error</div>,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    scrollRestoration: true,
  });
  return router;
}
```

## 4. Routes and Server Functions

The root route (`src/routes/__root.tsx`) defines the HTML shell, with `HeadContent` and `Scripts` for the head tags and the client scripts. Page routes can call server functions, created with `createServerFn`:

```tsx [src/routes/index.tsx]
const getServerTime = createServerFn({ method: "GET" }).handler(() => {
  return new Date().toISOString();
});

export const Route = createFileRoute("/")({
  loader: () => getServerTime(),
  component: Home,
});
```

API routes are defined in `src/routes/api/` with `server.handlers`.

## Commands

- `rsbuild dev`: development server, with reload on server changes and HMR for the client.
- `rsbuild build`: builds the client and the server into `.output/`, with any Nitro deployment preset.
- `rsbuild preview`: serves the production build with Nitro.

The prerendering and SPA mode of TanStack Start load the server build from the output directory of TanStack Start, which Nitro replaces: use the [prerender options](/config/routing#prerender) of Nitro instead.
