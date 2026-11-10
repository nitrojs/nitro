Set up server-side rendering (SSR) with React, [Rsbuild](https://rsbuild.rs), and the experimental `nitro/rsbuild` plugin. This setup enables streaming HTML responses, client asset injection with `?assets` imports, and client hydration.

## Overview

1. Add the Nitro and React plugins to your Rsbuild config
2. Configure the client entry point
3. Create a server entry that renders your app to HTML
4. Create a client entry that hydrates the server-rendered HTML
5. Add API routes for server-side data

## 1. Configure Rsbuild

Add the Nitro and React plugins to your Rsbuild config, and set the client entry point:

```ts [rsbuild.config.ts]
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { nitro } from "nitro/rsbuild";

export default defineConfig({
  source: {
    entry: { index: "./src/entry-client.tsx" },
  },
  // Pages are rendered by the server entry
  tools: { htmlPlugin: false },
  plugins: [pluginReact(), nitro({ serverDir: "./" })],
});
```

Nitro automatically detects the SSR entry from a file named `entry-server` in `app/`, `src/`, or the project root, and adds an `ssr` environment for it. The server entry renders the whole document, so the Rsbuild HTML generation is disabled with `tools.htmlPlugin: false`.

## 2. Create the App Component

Create a shared React component that runs on both server and client:

```tsx [src/app.tsx]
import { useState } from "react";

export function App() {
  const [count, setCount] = useState(0);
  return (
    <>
      <h1 className="hero">Nitro + Rsbuild + React</h1>
      <button onClick={() => setCount((c) => c + 1)}>Count is {count}</button>
    </>
  );
}
```

## 3. Create the Server Entry

The server entry renders your React app to a streaming HTML response, with `react-dom/server.edge`:

```tsx [src/entry-server.tsx]
import { renderToReadableStream } from "react-dom/server.edge";
import { App } from "./app.tsx";

import clientAssets from "./entry-client.tsx?assets=client";

export default {
  async fetch(_req: Request) {
    return new Response(
      await renderToReadableStream(
        <html lang="en">
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            {clientAssets.css.map((attr) => (
              <link key={attr.href} rel="stylesheet" {...attr} />
            ))}
            {clientAssets.js.map((attr) => (
              <script key={attr.href} defer src={attr.href} />
            ))}
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

The `?assets=client` import gives the scripts and stylesheets of the client entry (`src/entry-client.tsx`), in development and in production. The scripts are classic scripts (the last one is the `entry`), loaded with `defer`. Use `renderToReadableStream` to stream HTML as React renders, improving time-to-first-byte.

## 4. Create the Client Entry

The client entry imports the styles and hydrates the server-rendered HTML, attaching React's event handlers:

```tsx [src/entry-client.tsx]
import "./styles.css";
import { hydrateRoot } from "react-dom/client";
import { App } from "./app.tsx";

hydrateRoot(document.querySelector("#app")!, <App />);
```

The `hydrateRoot` function attaches React to the existing server-rendered DOM without re-rendering it. In development, `@rsbuild/plugin-react` enables React Fast Refresh for client code.

## 5. Add API Routes

Server routes (like `routes/api/hello.ts`) are served by Nitro next to the pages:

```ts [routes/api/hello.ts]
import { defineHandler } from "nitro";

export default defineHandler(() => ({ message: "Hello from Nitro!" }));
```
