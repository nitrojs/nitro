---
navigation:
  category: server side rendering
icon: i-material-symbols-html
---

# Rsbuild SSR HTML

> Server-side rendering with vanilla HTML, Rsbuild, and Nitro.

<!-- automd:ui-code-tree src="../../examples/rsbuild-ssr-html" default="app/entry-server.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="app/entry-server.ts" expandAll}

```html [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rsbuild + Nitro</title>
  </head>
  <body>
    <main id="app">
      <!--ssr-outlet-->
    </main>
  </body>
</html>
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "build": "rsbuild build",
    "dev": "rsbuild dev",
    "preview": "rsbuild preview"
  },
  "devDependencies": {
    "@rsbuild/core": "^2.3.0",
    "nitro": "latest"
  }
}
```

```ts [rsbuild.config.ts]
import { defineConfig } from "@rsbuild/core";
import { nitro } from "nitro/rsbuild";

export default defineConfig({
  source: {
    entry: { index: "./app/entry-client.ts" },
  },
  html: {
    template: "./index.html",
  },
  plugins: [nitro({ serverDir: "./" })],
});
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```ts [app/entry-client.ts]
const button = document.querySelector<HTMLButtonElement>("#counter")!;

let count = 0;
button.disabled = false;
button.addEventListener("click", () => {
  button.textContent = `Count: ${++count}`;
});
```

```ts [app/entry-server.ts]
import { fetch } from "nitro";

export default {
  async fetch(req: Request) {
    const { message } = (await fetch("/api/hello").then((res) => res.json())) as {
      message: string;
    };
    return /* html */ `
      <h1>${message}</h1>
      <p>Rendered on the server for <code>${new URL(req.url).pathname}</code>.</p>
      <button id="counter" disabled>Count: 0</button>
    `;
  },
};
```

```ts [routes/api/hello.ts]
import { defineHandler } from "nitro";

export default defineHandler(() => ({ message: "Hello from Nitro and Rsbuild!" }));
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/rsbuild-ssr-html/README.md" -->

This example renders an HTML template on the server with [Rsbuild](https://rsbuild.rs) and the experimental `nitro/rsbuild` plugin, without a framework.

## Overview

1. **Add the Nitro Rsbuild plugin** to your Rsbuild config
2. **Create an HTML template** with a `<!--ssr-outlet-->` comment where server content goes
3. **Create a server entry** (`app/entry-server.ts`) that renders the page content
4. **Create a client entry** (`app/entry-client.ts`) that makes the page interactive
5. **Add API routes** for server-side data

## How It Works

Nitro detects `app/entry-server.ts` and adds an `ssr` environment to the Rsbuild app. The server entry exports an object with a `fetch` method, which calls the `/api/hello` route with Nitro's internal fetch and returns the HTML of the page.

The `index.html` template is the Rsbuild HTML template of the client: Rsbuild injects the client scripts, and Nitro renders the `<!--ssr-outlet-->` comment with the server entry for each page request.

Run `rsbuild dev` for development, and `rsbuild build` to build the client and the server into `.output/`.

<!-- /automd -->

## Learn More

- [Rsbuild Integration](/docs/rsbuild)
- [Renderer](/docs/renderer)
