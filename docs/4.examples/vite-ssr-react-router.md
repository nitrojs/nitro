---
category: server side rendering
icon: i-logos-react
---

# SSR with React Router

> Server-side rendering with React Router in Nitro using Vite.

<!-- automd:ui-code-tree src="../../examples/vite-ssr-react-router" default="server/ssr.ts" ignore="README.md,favicon.ico,logos" expandAll -->

::code-tree{defaultValue="server/ssr.ts" expandAll}

```json [package.json]
{
  "name": "vite-ssr-react-router",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite dev",
    "start": "node ./build/server/index.mjs",
    "typegen": "react-router typegen"
  },
  "dependencies": {
    "@react-router/node": "8.1.0",
    "isbot": "^5.1.44",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-router": "8.1.0"
  },
  "devDependencies": {
    "@react-router/dev": "8.1.0",
    "@tailwindcss/vite": "^4.3.2",
    "@types/node": "^26.0.0",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "nitro": "latest",
    "tailwindcss": "^4.3.2",
    "typescript": "^6.0.3",
    "vite": "^8.1.3"
  }
}
```

```ts [react-router.config.ts]
import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  buildDirectory: "build",
} satisfies Config;
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig",
  "include": ["**/*", "**/.server/**/*", "**/.client/**/*", ".react-router/types/**/*"],
  "compilerOptions": {
    "types": ["node", "vite/client"],
    "jsx": "react-jsx",
    "rootDirs": [".", "./.react-router/types"],
    "paths": {
      "~/*": ["./app/*"]
    }
  }
}
```

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

```css [app/app.css]
@import "tailwindcss";

@theme {
  --font-sans:
    "Inter", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol", "Noto Color Emoji";
}

html,
body {
  @apply bg-white dark:bg-gray-950;

  @media (prefers-color-scheme: dark) {
    color-scheme: dark;
  }
}
```

```tsx [app/root.tsx]
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
```

```ts [app/routes.ts]
import { type RouteConfig, index } from "@react-router/dev/routes";

export default [index("routes/home.tsx")] satisfies RouteConfig;
```

```ts [server/ssr.ts]
import { createRequestHandler } from "react-router";

export default {
  fetch: createRequestHandler(
    () => import("virtual:react-router/server-build"),
    import.meta.env.MODE
  ),
};
```

```tsx [app/routes/home.tsx]
import type { Route } from "./+types/home";
import logoDark from "../logos/logo-dark.svg";
import logoLight from "../logos/logo-light.svg";
import nitroLogo from "../logos/nitro.svg";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: "Nitro + React Router" },
    { name: "description", content: "React Router SSR powered by Nitro." },
  ];
}

export default function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center sm:py-24">
      <h1 className="flex items-center gap-5 sm:gap-8">
        <span className="sr-only">Nitro + React Router</span>
        <img className="size-16 sm:size-24" src={nitroLogo} alt="" aria-hidden />
        <span
          className="text-4xl font-light text-gray-300 sm:text-6xl dark:text-gray-600"
          aria-hidden
        >
          +
        </span>
        <picture>
          <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
          <img className="w-48 sm:w-80" src={logoLight} alt="" aria-hidden />
        </picture>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-300">
        Full-stack React Router, powered by Nitro.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
        <a
          className="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-950 hover:decoration-gray-500 dark:text-gray-300 dark:decoration-gray-700 dark:hover:text-white dark:hover:decoration-gray-500"
          href="https://nitro.build"
          target="_blank"
          rel="noreferrer"
        >
          Nitro Docs ↗
        </a>
        <a
          className="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-950 hover:decoration-gray-500 dark:text-gray-300 dark:decoration-gray-700 dark:hover:text-white dark:hover:decoration-gray-500"
          href="https://reactrouter.com/docs"
          target="_blank"
          rel="noreferrer"
        >
          React Router Docs ↗
        </a>
      </div>

      <section className="mt-16 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="font-semibold text-gray-950 dark:text-white">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              {feature.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

const features = [
  {
    title: "Portable deployments",
    description: "Use presets to build the same app for Node, workers, and serverless runtimes.",
  },
  {
    title: "Backend primitives",
    description: "Use portable caching, storage, databases, route rules, and runtime tasks.",
  },
  {
    title: "One production server",
    description: "Serve SSR, client assets, and API routes from a single production output.",
  },
  {
    title: "One Vite lifecycle",
    description: "Develop and build the React Router frontend and Nitro backend together.",
  },
  {
    title: "In-process requests",
    description: "Call Nitro routes from loaders without an origin or network round trip.",
  },
  {
    title: "Routing without glue",
    description: "Handle server routes first, then fall through to React Router SSR automatically.",
  },
];
```

```ts [server/routes/health.get.ts]
import { defineHandler } from "nitro";

export default defineHandler(() => {
  return { status: "OK" };
});
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/vite-ssr-react-router/README.md" -->

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

<!-- /automd -->

## Learn More

- [React Router Documentation](https://reactrouter.com/)
- [Directory options](/docs/configuration#directory-options)
