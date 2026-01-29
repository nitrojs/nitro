---
category: server side rendering
icon: i-simple-icons-tanstack
defaultFile: src/main.tsx
---

# Vite SSR with TanStack Router

> Client-side routing with TanStack Router in Nitro using Vite.

Set up TanStack Router with React, Vite, and Nitro. This setup provides file-based routing with type-safe navigation and automatic code splitting.

<!-- automd:dir-tree -->

```
├── src/
│   ├── assets/
│   │   └── main.css
│   ├── routes/
│   │   ├── __root.tsx
│   │   └── index.tsx
│   ├── main.tsx
│   └── routeTree.gen.ts
├── index.html
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.mjs
```

<!-- /automd -->

## Overview

1. Add the Nitro Vite plugin to your Vite config
2. Create an HTML template with your app entry
3. Create a main entry that initializes the router
4. Define routes using file-based routing

## 1. Configure Vite

Add the Nitro, React, and TanStack Router plugins to your Vite config:

<!-- automd:file src="vite.config.mjs" code -->

```mjs [vite.config.mjs]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), nitro()],
});
```

<!-- /automd -->

The `tanstackRouter` plugin generates a route tree from your `routes/` directory structure. Enable `autoCodeSplitting` to automatically split routes into separate chunks. Place the TanStack Router plugin before the React plugin in the array.

## 2. Create the HTML Template

Create an HTML file that serves as your app shell:

<!-- automd:file src="index.html" code lang="html" -->

```html [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nitro + TanStack Router + React</title>
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

<!-- /automd -->

## 3. Create the App Entry

Create the main entry that initializes TanStack Router:

<!-- automd:file src="src/main.tsx" code -->

```tsx [main.tsx]
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen.ts";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.querySelector("#root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
```

<!-- /automd -->

The `routeTree.gen.ts` file is auto-generated from your `routes/` directory structure. The `Register` interface declaration provides full type inference for route paths and params. The `!rootElement.innerHTML` check prevents re-rendering during hot module replacement.

## 4. Create the Root Route

The root route (`__root.tsx`) defines your app's layout:

<!-- automd:file src="src/routes/__root.tsx" code -->

```tsx [__root.tsx]
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

const RootLayout = () => (
  <>
    <div className="p-2 flex gap-2">
      <Link to="/" className="[&.active]:font-bold">
        Home
      </Link>
    </div>
    <hr />
    <Outlet />
    <TanStackRouterDevtools />
  </>
);

export const Route = createRootRoute({ component: RootLayout });
```

<!-- /automd -->

Use `Link` for type-safe navigation with active state styling. The `Outlet` component renders child routes. Include `TanStackRouterDevtools` for development tools (automatically removed in production).

## 5. Create Page Routes

Page routes use `createFileRoute` and can include loaders:

<!-- automd:file src="src/routes/index.tsx" code -->

```tsx [index.tsx]
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: async () => {
    const r = await fetch("/api/hello");
    return r.json();
  },
  component: Index,
});

function Index() {
  const r = Route.useLoaderData();

  return (
    <div className="p-2">
      <h3>{JSON.stringify(r)}</h3>
    </div>
  );
}
```

<!-- /automd -->

Fetch data before rendering with the `loader` function—data is available via `Route.useLoaderData()`. File paths determine URL paths: `routes/index.tsx` maps to `/`, `routes/about.tsx` to `/about`, and `routes/users/$id.tsx` to `/users/:id`.

## Learn More

- [TanStack Router Documentation](https://tanstack.com/router)
- [Renderer](/docs/renderer)
