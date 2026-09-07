Set up React Router framework mode with Vite and Nitro. This setup uses Nitro to run the React Router server build in development and production.

## Overview

1. Add the React Router and Nitro plugins to your Vite config
2. Configure Nitro to emit its server alongside React Router's client build
3. Create an SSR handler using React Router's request handler
4. Add Nitro server routes
5. Define routes using React Router's route configuration

## 1. Configure Vite

Add the React Router, Tailwind CSS, and Nitro plugins to your Vite config:

```ts [vite.config.ts]
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import reactRouterConfig from "./react-router.config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    nitro({
      serverDir: "./server",
      output: {
        dir: reactRouterConfig.buildDirectory,
        serverDir: `${reactRouterConfig.buildDirectory}/server`,
        publicDir: `${reactRouterConfig.buildDirectory}/client`,
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  environments: {
    ssr: { build: { rollupOptions: { input: "./server/ssr.ts" } } },
  },
});
```

React Router creates the `ssr` environment and builds browser assets into `build/client`. The custom input points to the fetch-compatible handler in `server/ssr.ts`. Nitro scans `server/` for its own routes, then emits the production server into `build/server`.

## 2. Configure React Router

Enable SSR and keep the build directory in sync with the Nitro output configuration:

```ts [react-router.config.ts]
import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  buildDirectory: "build",
} satisfies Config;
```

React Router generates the server build exposed by `virtual:react-router/server-build` and the client assets required for hydration.

## 3. Create the SSR Handler

Create an SSR handler that delegates incoming requests to React Router:

```ts [server/ssr.ts]
import { createRequestHandler } from "react-router";

export default {
  fetch: createRequestHandler(
    () => import("virtual:react-router/server-build"),
    import.meta.env.MODE
  ),
};
```

Nitro invokes the exported Web `fetch` handler through the Vite `ssr` service in development and production. The request handler loads React Router's generated server build and renders the matched route.

## 4. Add Nitro Server Routes

Add API and other server routes under `server/routes/`:

```ts [server/routes/health.get.ts]
import { defineHandler } from "nitro";

export default defineHandler(() => {
  return { status: "OK" };
});
```

This route is available at `/health` and is handled by Nitro before requests fall through to the React Router SSR service.

## 5. Define React Router Routes

Declare the application's route modules in `app/routes.ts`:

```ts [app/routes.ts]
import { type RouteConfig, index } from "@react-router/dev/routes";

export default [index("routes/home.tsx")] satisfies RouteConfig;
```

The index route renders the home page at `/`.
