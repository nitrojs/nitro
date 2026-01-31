---
category: server side rendering
icon: i-logos-react
---

# SSR with React

> Server-side rendering with React in Nitro using Vite.

<!-- automd:ui-code-tree src="." default="src/entry-server.tsx" ignore="README.md" expandAll -->

::code-tree{defaultValue="src/entry-server.tsx" expandAll}

```json [package.json]
{
  "type": "module",
  "scripts": {
    "build": "vite build",
    "preview": "vite preview",
    "dev": "vite dev"
  },
  "devDependencies": {
    "@types/react": "^19.2.10",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.2",
    "nitro": "latest",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-refresh": "^0.18.0",
    "vite": "beta"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

```js [vite.config.mjs]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [nitro(), react()],
  environments: {
    client: {
      build: { rollupOptions: { input: "./src/entry-client.tsx" } },
    },
  },
});
```

```tsx [src/app.tsx]
import { useState } from "react";

export function App() {
  const [count, setCount] = useState(0);
  return (
    <>
      <h1 className="hero">Nitro + Vite + React</h1>
      <button onClick={() => setCount((c) => c + 1)}>Count is {count}</button>
    </>
  );
}
```

```tsx [src/entry-client.tsx]
import "@vitejs/plugin-react/preamble";
import { hydrateRoot } from "react-dom/client";
import { App } from "./app.tsx";

hydrateRoot(document.querySelector("#app")!, <App />);
```

```tsx [src/entry-server.tsx]
import "./styles.css";
import { renderToReadableStream } from "react-dom/server.edge";
import { App } from "./app.tsx";

import clientAssets from "./entry-client?assets=client";
import serverAssets from "./entry-server?assets=ssr";

export default {
  async fetch(_req: Request) {
    const assets = clientAssets.merge(serverAssets);
    return new Response(
      await renderToReadableStream(
        <html lang="en">
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            {assets.css.map((attr: any) => (
              <link key={attr.href} rel="stylesheet" {...attr} />
            ))}
            {assets.js.map((attr: any) => (
              <link key={attr.href} type="modulepreload" {...attr} />
            ))}
            <script type="module" src={assets.entry} />
          </head>
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

```css [src/styles.css]
.hero {
  color: orange;
}

button {
  background-color: lightskyblue;
}
```

::

<!-- /automd -->

Set up server-side rendering (SSR) with React, Vite, and Nitro. This setup enables streaming HTML responses, automatic asset management, and client hydration.

## Overview

1. Add the Nitro Vite plugin to your Vite config
2. Configure client and server entry points
3. Create a server entry that renders your app to HTML
4. Create a client entry that hydrates the server-rendered HTML

## 1. Configure Vite

Add the Nitro and React plugins to your Vite config. Define the `client` environment with your client entry point:

<!-- automd:file src="vite.config.mjs" code -->

```mjs [vite.config.mjs]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [nitro(), react()],
  environments: {
    client: {
      build: { rollupOptions: { input: "./src/entry-client.tsx" } },
    },
  },
});
```

<!-- /automd -->

The `environments.client` configuration tells Vite which file to use as the browser entry point. Nitro automatically detects the server entry from files named `entry-server` or `server` in common directories.

## 2. Create the App Component

Create a shared React component that runs on both server and client:

<!-- automd:file src="src/app.tsx" code -->

```tsx [app.tsx]
import { useState } from "react";

export function App() {
  const [count, setCount] = useState(0);
  return (
    <>
      <h1 className="hero">Nitro + Vite + React</h1>
      <button onClick={() => setCount((c) => c + 1)}>Count is {count}</button>
    </>
  );
}
```

<!-- /automd -->

## 3. Create the Server Entry

The server entry renders your React app to a streaming HTML response. It uses `react-dom/server.edge` for edge-compatible streaming:

<!-- automd:file src="src/entry-server.tsx" code -->

```tsx [entry-server.tsx]
import "./styles.css";
import { renderToReadableStream } from "react-dom/server.edge";
import { App } from "./app.tsx";

import clientAssets from "./entry-client?assets=client";
import serverAssets from "./entry-server?assets=ssr";

export default {
  async fetch(_req: Request) {
    const assets = clientAssets.merge(serverAssets);
    return new Response(
      await renderToReadableStream(
        <html lang="en">
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            {assets.css.map((attr: any) => (
              <link key={attr.href} rel="stylesheet" {...attr} />
            ))}
            {assets.js.map((attr: any) => (
              <link key={attr.href} type="modulepreload" {...attr} />
            ))}
            <script type="module" src={assets.entry} />
          </head>
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

<!-- /automd -->

Import assets using the `?assets=client` and `?assets=ssr` query parameters. Nitro collects CSS and JS assets from each entry point, and `merge()` combines them into a single manifest. The `assets` object provides arrays of stylesheet and script attributes, plus the client entry URL. Use `renderToReadableStream` to stream HTML as React renders, improving time-to-first-byte.

## 4. Create the Client Entry

The client entry hydrates the server-rendered HTML, attaching React's event handlers:

<!-- automd:file src="src/entry-client.tsx" code -->

```tsx [entry-client.tsx]
import "@vitejs/plugin-react/preamble";
import { hydrateRoot } from "react-dom/client";
import { App } from "./app.tsx";

hydrateRoot(document.querySelector("#app")!, <App />);
```

<!-- /automd -->

The `@vitejs/plugin-react/preamble` import is required for React Fast Refresh during development. The `hydrateRoot` function attaches React to the existing server-rendered DOM without re-rendering it.

## Learn More

- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
