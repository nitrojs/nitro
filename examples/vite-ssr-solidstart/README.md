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
