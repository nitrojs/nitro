---
category: server side rendering
icon: i-simple-icons-tanstack
defaultFile: server.ts
---

# Vite SSR with TanStack Start

> Full-stack React with TanStack Start in Nitro using Vite.

Set up TanStack Start with Nitro for a full-stack React framework experience with server-side rendering, file-based routing, and integrated API routes.

<!-- automd:dir-tree -->

```
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   └── index.tsx
│   ├── styles/
│   │   └── app.css
│   ├── router.tsx
│   └── routeTree.gen.ts
├── .gitignore
├── package.json
├── README.md
├── server.ts
├── tsconfig.json
└── vite.config.mjs
```

<!-- /automd -->

## Overview

1. Add the Nitro Vite plugin to your Vite config
2. Create a server entry using TanStack Start's server handler
3. Configure the router with default components
4. Define routes and API endpoints using file-based routing

## 1. Configure Vite

Add the Nitro, React, TanStack Start, and Tailwind plugins to your Vite config:

<!-- automd:file src="vite.config.mjs" code -->

```mjs [vite.config.mjs]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    nitro(),
  ],
  environments: {
    ssr: { build: { rollupOptions: { input: "./server.ts" } } },
  },
});
```

<!-- /automd -->

The `tanstackStart()` plugin provides full SSR integration with automatic client entry handling. Use `viteTsConfigPaths()` to enable path aliases like `~/` from tsconfig. The `environments.ssr` option points to the server entry file.

## 2. Create the Server Entry

Create a server entry that uses TanStack Start's handler:

<!-- automd:file src="server.ts" code -->

```ts [server.ts]
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
```

<!-- /automd -->

TanStack Start handles SSR automatically. The `createServerEntry` wrapper integrates with Nitro's server entry format, and the `handler.fetch` processes all incoming requests.

## 3. Configure the Router

Create a router factory function with default error and not-found components:

<!-- automd:file src="src/router.tsx" code -->

```tsx [router.tsx]
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

<!-- /automd -->

The router factory configures preloading behavior, scroll restoration, and default error/not-found components.

## 4. Create the Root Route

The root route defines your HTML shell with head management and scripts:

<!-- automd:file src="src/routes/__root.tsx" code -->

```tsx [__root.tsx]
/// <reference types="vite/client" />
import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [{ src: "/customScript.js", type: "text/javascript" }],
  }),
  errorComponent: () => <h1>500: Internal Server Error</h1>,
  notFoundComponent: () => <h1>404: Page Not Found</h1>,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="p-2 flex gap-2 text-lg">
          <Link to="/" activeProps={{ className: "font-bold" }} activeOptions={{ exact: true }}>
            Home
          </Link>{" "}
          <Link
            // @ts-ignore
            to="/this-route-does-not-exist"
            activeProps={{ className: "font-bold" }}
          >
            404
          </Link>
        </div>
        <hr />
        {children}
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
```

<!-- /automd -->

Define meta tags, stylesheets, and scripts in the `head()` function. The `shellComponent` provides the HTML document shell that wraps all pages. Use `HeadContent` to render the head configuration and `Scripts` to inject the client-side JavaScript for hydration.

## 5. Create Page Routes

Page routes define your application pages:

<!-- automd:file src="src/routes/index.tsx" code -->

```tsx [index.tsx]
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="p-2">
      <h3>Welcome Home!</h3>
      <a href="/api/test">/api/test</a>
    </div>
  );
}
```

<!-- /automd -->

## API Routes

TanStack Start supports API routes alongside page routes. Create files in `src/routes/api/` to define server endpoints that Nitro serves automatically.

## Learn More

- [TanStack Start Documentation](https://tanstack.com/start)
- [Server Entry](/docs/server-entry)
