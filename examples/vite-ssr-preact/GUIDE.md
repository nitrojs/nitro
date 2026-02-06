Set up server-side rendering (SSR) with Preact, Vite, and Nitro. This setup enables streaming HTML responses, automatic asset management, and client hydration.

## Overview

1. Add the Nitro Vite plugin to your Vite config
2. Configure client and server entry points
3. Create a server entry that renders your app to HTML
4. Create a client entry that hydrates the server-rendered HTML

## 1. Configure Vite

Add the Nitro and Preact plugins to your Vite config. Define the `client` environment with your client entry point:

```js [vite.config.mjs]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [nitro(), preact()],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: "./src/entry-client.tsx",
        },
      },
    },
  },
});
```

The `environments.client` configuration tells Vite which file to use as the browser entry point. Nitro automatically detects the server entry from files named `entry-server` or `server` in common directories.

## 2. Create the App Component

Create a shared Preact component that runs on both server and client:

```tsx [src/app.tsx]
import { useState } from "preact/hooks";

export function App() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>Count is {count}</button>;
}
```

## 3. Create the Server Entry

The server entry renders your Preact app to a streaming HTML response using `preact-render-to-string/stream`:

```tsx [src/entry-server.tsx]
import "./styles.css";
import { renderToReadableStream } from "preact-render-to-string/stream";
import { App } from "./app.jsx";

import clientAssets from "./entry-client?assets=client";
import serverAssets from "./entry-server?assets=ssr";

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const htmlStream = renderToReadableStream(<Root url={url} />);
    return new Response(htmlStream, {
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  },
};

function Root(props: { url: URL }) {
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
        <script type="module" src={assets.entry} />
      </head>
      <body>
        <h1 className="hero">Nitro + Vite + Preact</h1>
        <p>URL: {props.url.href}</p>
        <div id="app">
          <App />
        </div>
      </body>
    </html>
  );
}
```

Import assets using the `?assets=client` and `?assets=ssr` query parameters. Nitro collects CSS and JS assets from each entry point, and `merge()` combines them into a single manifest. The `assets` object provides arrays of stylesheet and script attributes, plus the client entry URL. Use `renderToReadableStream` to stream HTML as Preact renders, improving time-to-first-byte.

## 4. Create the Client Entry

The client entry hydrates the server-rendered HTML, attaching Preact's event handlers:

```tsx [src/entry-client.tsx]
import { hydrate } from "preact";
import { App } from "./app.tsx";

function main() {
  hydrate(<App />, document.querySelector("#app")!);
}

main();
```

The `hydrate` function attaches Preact to the existing server-rendered DOM inside `#app` without re-rendering it.
