---
category: server side rendering
icon: i-logos-solidjs-icon
---

# SSR with SolidJS

> Server-side rendering with SolidJS in Nitro using Vite.

<!-- automd:ui-code-tree src="." default="src/entry-server.tsx" ignore="README.md" expandAll -->

::code-tree{defaultValue="src/entry-server.tsx" expandAll}

```json [package.json]
{
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite dev"
  },
  "devDependencies": {
    "nitro": "latest",
    "solid-js": "^1.9.11",
    "vite": "beta",
    "vite-plugin-solid": "^2.11.10"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig",
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

```js [vite.config.mjs]
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [solid({ ssr: true }), nitro()],
  esbuild: { jsx: "preserve", jsxImportSource: "solid-js" },
  environments: {
    ssr: {
      build: { rollupOptions: { input: "./src/entry-server.tsx" } },
    },
    client: {
      build: { rollupOptions: { input: "./src/entry-client.tsx" } },
    },
  },
});
```

```tsx [src/app.tsx]
import { createSignal } from "solid-js";

export function App() {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <h1>Hello, Solid!</h1>
      <button onClick={() => setCount((count) => count + 1)}>Count: {count()}</button>
    </div>
  );
}
```

```tsx [src/entry-client.tsx]
import { hydrate } from "solid-js/web";
import "./styles.css";
import { App } from "./app.jsx";

hydrate(() => <App />, document.querySelector("#app")!);
```

```tsx [src/entry-server.tsx]
import { renderToStringAsync, HydrationScript } from "solid-js/web";
import { App } from "./app.jsx";

import clientAssets from "./entry-client?assets=client";
import serverAssets from "./entry-server?assets=ssr";

export default {
  async fetch(req: Request): Promise<Response> {
    const appHTML = await renderToStringAsync(() => <App />);
    const rootHTML = await renderToStringAsync(() => <Root appHTML={appHTML} />);
    return new Response(rootHTML, {
      headers: { "Content-Type": "text/html" },
    });
  },
};

function Root(props: { appHTML?: string }) {
  const assets = clientAssets.merge(serverAssets);
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {assets.css.map((attr: any) => (
          <link key={attr.href} rel="stylesheet" {...attr} />
        ))}
        {assets.js.map((attr: any) => (
          <link key={attr.href} type="modulepreload" {...attr} />
        ))}
      </head>
      <body>
        <div id="app" innerHTML={props.appHTML || ""} />
        <HydrationScript />
        <script type="module" src={assets.entry} />
      </body>
    </html>
  );
}
```

```css [src/styles.css]
div {
  font-family: system-ui, Arial, sans-serif;
  font-size: 20px;
  margin-bottom: 10px;
}

button {
  background-color: rgb(147 197 253);
  color: rgb(15 23 42);
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  border-radius: 5px;
}

button:hover {
  background-color: rgb(191 219 254);
}
```

::

<!-- /automd -->

Set up server-side rendering (SSR) with SolidJS, Vite, and Nitro. This setup uses `renderToStringAsync` for HTML generation and supports client hydration.

## Overview

1. Add the Nitro Vite plugin to your Vite config
2. Configure client and server entry points
3. Create a server entry that renders your app to HTML
4. Create a client entry that hydrates the server-rendered HTML

## 1. Configure Vite

Add the Nitro and SolidJS plugins to your Vite config. SolidJS requires explicit JSX configuration and both `ssr` and `client` environments:

<!-- automd:file src="vite.config.mjs" code -->

```mjs [vite.config.mjs]
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [solid({ ssr: true }), nitro()],
  esbuild: { jsx: "preserve", jsxImportSource: "solid-js" },
  environments: {
    ssr: {
      build: { rollupOptions: { input: "./src/entry-server.tsx" } },
    },
    client: {
      build: { rollupOptions: { input: "./src/entry-client.tsx" } },
    },
  },
});
```

<!-- /automd -->

Enable SSR mode in the Solid plugin with `solid({ ssr: true })`. Configure esbuild to preserve JSX for Solid's compiler and use Solid's JSX runtime. SolidJS requires explicit `ssr` and `client` environment configuration in Vite.

## 2. Create the App Component

Create a shared SolidJS component using reactive signals:

<!-- automd:file src="src/app.tsx" code -->

```tsx [app.tsx]
import { createSignal } from "solid-js";

export function App() {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <h1>Hello, Solid!</h1>
      <button onClick={() => setCount((count) => count + 1)}>Count: {count()}</button>
    </div>
  );
}
```

<!-- /automd -->

SolidJS uses signals (`createSignal`) for state management. Unlike React's `useState`, signals are getter functions that you call to read the value.

## 3. Create the Server Entry

The server entry renders your SolidJS app to HTML using `renderToStringAsync` and includes the `HydrationScript` for client-side hydration:

<!-- automd:file src="src/entry-server.tsx" code -->

```tsx [entry-server.tsx]
import { renderToStringAsync, HydrationScript } from "solid-js/web";
import { App } from "./app.jsx";

import clientAssets from "./entry-client?assets=client";
import serverAssets from "./entry-server?assets=ssr";

export default {
  async fetch(req: Request): Promise<Response> {
    const appHTML = await renderToStringAsync(() => <App />);
    const rootHTML = await renderToStringAsync(() => <Root appHTML={appHTML} />);
    return new Response(rootHTML, {
      headers: { "Content-Type": "text/html" },
    });
  },
};

function Root(props: { appHTML?: string }) {
  const assets = clientAssets.merge(serverAssets);
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {assets.css.map((attr: any) => (
          <link key={attr.href} rel="stylesheet" {...attr} />
        ))}
        {assets.js.map((attr: any) => (
          <link key={attr.href} type="modulepreload" {...attr} />
        ))}
      </head>
      <body>
        <div id="app" innerHTML={props.appHTML || ""} />
        <HydrationScript />
        <script type="module" src={assets.entry} />
      </body>
    </html>
  );
}
```

<!-- /automd -->

SolidJS requires rendering the app separately from the shell (two-phase rendering). The app HTML is injected via `innerHTML` to preserve hydration markers. Include the `HydrationScript` component to inject the script Solid needs to rehydrate on the client. Import assets using the `?assets=client` and `?assets=ssr` query parameters to collect CSS and JS from each entry point.

## 4. Create the Client Entry

The client entry hydrates the server-rendered HTML, restoring Solid's reactivity:

<!-- automd:file src="src/entry-client.tsx" code -->

```tsx [entry-client.tsx]
import { hydrate } from "solid-js/web";
import "./styles.css";
import { App } from "./app.jsx";

hydrate(() => <App />, document.querySelector("#app")!);
```

<!-- /automd -->

The `hydrate` function attaches Solid's reactive system to the existing server-rendered DOM inside `#app`. The component is wrapped in a function `() => <App />` as required by Solid's API.

## Learn More

- [SolidJS Documentation](https://docs.solidjs.com/)
- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
