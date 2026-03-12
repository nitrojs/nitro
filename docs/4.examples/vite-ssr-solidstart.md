---
category: server side rendering
icon: i-logos-solidjs-icon
---

# SSR with SolidStart

> Server-side rendering with SolidStart in Nitro using Vite.

<!-- automd:ui-code-tree src="../../examples/vite-ssr-solidstart" default="src/entry-server.tsx" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="src/entry-server.tsx" expandAll}

```json [package.json]
{
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build"
  },
  "dependencies": {
    "@solidjs/meta": "^0.29.4",
    "@solidjs/router": "^0.15.4",
    "@solidjs/start": "^2.0.0-alpha.2",
    "nitro": "^3.0.260311-beta",
    "solid-js": "^1.9.11",
    "vite": "^8.0.0"
  },
  "engines": {
    "node": ">=22"
  }
}
```

```json [tsconfig.json]
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "allowJs": true,
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": ["@solidjs/start/env"],
    "paths": {
      "~/*": ["./src/*"]
    }
  }
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [solidStart(), nitro()],
});
```

```css [src/app.css]
body {
  font-family:
    Gordita, Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
}

a {
  margin-right: 1rem;
}

main {
  text-align: center;
  padding: 1em;
  margin: 0 auto;
}

h1 {
  color: #335d92;
  text-transform: uppercase;
  font-size: 4rem;
  font-weight: 100;
  line-height: 1.1;
  margin: 4rem auto;
  max-width: 14rem;
}

p {
  max-width: 14rem;
  margin: 2rem auto;
  line-height: 1.35;
}

@media (min-width: 480px) {
  h1 {
    max-width: none;
  }

  p {
    max-width: none;
  }
}
```

```tsx [src/app.tsx]
import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>SolidStart - Basic</Title>
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
```

```tsx [src/entry-client.tsx]
// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

mount(() => <StartClient />, document.getElementById("app")!);
```

```tsx [src/entry-server.tsx]
// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
```

```tsx [src/routes/[...404].tsx]
import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";

export default function NotFound() {
  return (
    <main>
      <Title>Not Found</Title>
      <HttpStatusCode code={404} />
      <h1>Page Not Found</h1>
      <p>
        Visit{" "}
        <a href="https://start.solidjs.com" target="_blank">
          start.solidjs.com
        </a>{" "}
        to learn how to build SolidStart apps.
      </p>
    </main>
  );
}
```

```tsx [src/routes/index.tsx]
import { Title } from "@solidjs/meta";

export default function Home() {
  return (
    <main>
      <Title>Hello World</Title>
      <h1>Hello world!</h1>
      <p>
        Visit{" "}
        <a href="https://start.solidjs.com" target="_blank">
          start.solidjs.com
        </a>{" "}
        to learn how to build SolidStart apps.
      </p>
    </main>
  );
}
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/vite-ssr-solidstart/README.md" -->

Set up server-side rendering (SSR) with Solid, Vite, and Nitro. This setup enables streaming HTML responses, automatic asset management, and client hydration.

## Overview

1. Add the Nitro Vite plugin to your Vite config
2. Create a server entry that renders your app to HTML
3. Create a client entry that hydrates the server-rendered HTML

## 1. Configure Vite

Add the SolidStart and Nitro plugins to your Vite config.

```js [vite.config.ts]
import { defineConfig } from "vite";
import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [solidStart(), nitro()],
});
```

## 2. Create the App Component

Create a shared Solid component that runs on both server and client:

```tsx [src/app.tsx]
import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>SolidStart - Basic</Title>
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
```

## 3. Create the Server Entry

The server entry renders your Solid app to a streaming HTML response:

```tsx [src/entry-server.tsx]
// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
```

## 4. Create the Client Entry

The client entry hydrates the server-rendered HTML, attaching Solid's event handlers:

```tsx [src/entry-client.tsx]
// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

mount(() => <StartClient />, document.getElementById("app")!);
```

<!-- /automd -->

## Learn More

- [SolidJS Documentation](https://docs.solidjs.com/)
- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
