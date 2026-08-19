---
seo:
  title: Build Full-Stack Servers
  description: Nitro builds production-ready servers that run anywhere. Add API routes to any app, then deploy the same codebase to Node.js, Bun, Deno, edge workers or serverless — with zero configuration.
---

::page-hero
:hero-command{command="create-nitro-app"}

#title
Build [/Servers]{.text-brand}

#description
Nitro builds production-ready servers that run anywhere. Add API routes to any app, then deploy the same codebase to Node.js, Bun, Deno, edge workers or serverless — with zero configuration.

#links
:app-hero-links
::

::stat-strip
---
stats:
  - value: "3.8 kB"
    label: Gzipped output
  - value: "0"
    label: Runtime deps
  - value: "25+"
    label: Deploy targets
  - value: "~50 ms"
    label: Cold start
caption: Minimal standard server fixture. Cold start on Node.js.
---
::

::feature-section
---
eyebrow: Routing
link: /docs/routing
link-label: Routing docs
points:
  - Routes are compiled — no runtime router ships in the bundle
  - Dynamic params, wildcards and per-method files
  - Route groups organize files without changing URLs
---
#title
Files in, routes out

#description
Drop a file in `routes/` and it becomes a route. Append the HTTP method to the filename to scope it, nest folders for path params, and wrap a folder in parentheses to group routes without touching the URL.

#visual
  :::route-map
  ---
  dir: routes/
  routes:
    - file: hello.get.ts
      method: GET
      route: /hello
    - file: hello.post.ts
      method: POST
      route: /hello
    - file: api/test.ts
      route: /api/test
    - file: api/[org]/[repo].ts
      route: /api/:org/:repo
    - file: (admin)/users.ts
      route: /users
  ---
  :::
::

::feature-section
---
eyebrow: Server entry
reverse: true
link: /docs/server-entry
link-label: Server entry docs
---
#title
Bring your own framework

#description
Any framework that speaks the Web `fetch(request): Response` interface can be your server entry — export it from `server.ts` and it runs for every request before routes are matched. Node-style `(req, res)` frameworks work too: name the file `server.node.ts` and Nitro adapts it.

#visual
  :::tabs
    ::::tab{label="H3"}
    ```ts [server.ts]
    import { H3 } from "h3";

    const app = new H3();

    app.get("/", () => "⚡️ Hello from H3!");

    export default app;
    ```
    ::::

    ::::tab{label="Hono"}
    ```ts [server.ts]
    import { Hono } from "hono";

    const app = new Hono();

    app.get("/", (c) => c.text("🔥 Hello from Hono!"));

    export default app;
    ```
    ::::

    ::::tab{label="Elysia"}
    ```ts [server.ts]
    import { Elysia } from "elysia";

    const app = new Elysia();

    app.get("/", () => "🦊 Hello from Elysia!");

    export default app.compile();
    ```
    ::::

    ::::tab{label="Express"}
    ```ts [server.node.ts]
    import Express from "express";

    const app = Express();

    app.use("/", (_req, res) => {
      res.send("Hello from Express with Nitro!");
    });

    export default app;
    ```
    ::::
  :::
::

::feature-section
---
eyebrow: Deploy
link: /deploy
link-label: All deploy targets
points:
  - Providers are auto-detected in CI — no adapter to install
  - Switch targets with a single `preset` option
  - Compatibility dates keep provider behavior stable over time
---
#title
One codebase, every platform

#description
The same server builds for Node.js, Deno, Bun, edge workers and serverless functions. Nitro emits the output format each host expects, so moving between them is a config change, not a rewrite.

#visual
  :::deploy-grid
  ---
  more: 25+ targets
  moreTo: /deploy
  targets:
    - name: Node.js
      icon: i-simple-icons-nodedotjs
      to: /deploy/runtimes/node
    - name: Deno
      icon: i-simple-icons-deno
      to: /deploy/runtimes/deno
    - name: Bun
      icon: i-simple-icons-bun
      to: /deploy/runtimes/bun
    - name: Cloudflare
      icon: i-simple-icons-cloudflare
      to: /deploy/providers/cloudflare
    - name: Vercel
      icon: i-simple-icons-vercel
      to: /deploy/providers/vercel
    - name: Netlify
      icon: i-simple-icons-netlify
      to: /deploy/providers/netlify
    - name: AWS Lambda
      icon: i-simple-icons-awslambda
      to: /deploy/providers/aws
    - name: Azure
      icon: i-simple-icons-microsoftazure
      to: /deploy/providers/azure
    - name: Firebase
      icon: i-simple-icons-firebase
      to: /deploy/providers/firebase
    - name: DigitalOcean
      icon: i-simple-icons-digitalocean
      to: /deploy/providers/digitalocean
    - name: Render
      icon: i-simple-icons-render
      to: /deploy/providers/render
  ---
  :::
::

::feature-section
---
eyebrow: Output
reverse: true
link: /docs/quick-start
link-label: Build your first server
---
#title
Small enough to read

#description
A production build of a minimal Nitro server is three files with nothing to install alongside them. Dependencies are bundled and tree-shaken, so what you deploy is the code you wrote plus the little that runs it.

#visual
  :::bar-chart
  ---
  title: Production server output
  caption: Minimal Nitro server built with Rolldown
  data:
    - label: Unminified
      value: 16.2
      display: 16.2 kB
    - label: Minified
      value: 8.8
      display: 8.8 kB
    - label: Minified + gzipped
      value: 3.8
      display: 3.8 kB
      highlight: true
  ---
  :::
::

::feature-section
---
eyebrow: Cache
link: /docs/cache
link-label: Caching docs
points:
  - Stale-while-revalidate responses by default
  - ETag, last-modified and 304 handling out of the box
  - Concurrent requests for one key share a single invocation
---
#title
Caching that follows your storage

#description
Wrap a handler or any async function and Nitro caches its result on the same storage layer your app already uses — memory in development, Redis, Cloudflare KV or the filesystem in production. Same code, different backend.

#visual
  ```ts [routes/stars.ts]
  import { defineCachedHandler } from "nitro/cache";

  export default defineCachedHandler(
    async () => {
      const res = await fetch("https://api.github.com/repos/nitrojs/nitro");
      const { stargazers_count } = await res.json();
      return { stars: stargazers_count };
    },
    { maxAge: 60 * 60 }
  );
  ```
::

::feature-grid
---
eyebrow: Included
title: Everything a server needs
description: The pieces most apps reach for ship with Nitro, and every one of them behaves the same on every deployment target.
features:
  - title: KV Storage
    description: One key-value API over the filesystem, Redis, Cloudflare KV and more.
    icon: i-lucide-hard-drive
    to: /docs/storage
  - title: Database
    description: SQL layer powered by db0, preconfigured with SQLite.
    icon: i-lucide-database
    badge: Experimental
    to: /docs/database
  - title: Tasks
    description: One-off runtime operations, run from the CLI or on a cron schedule.
    icon: i-lucide-list-checks
    badge: Experimental
    to: /docs/tasks
  - title: WebSockets
    description: Cross-runtime WebSocket support built on crossws.
    icon: i-lucide-radio
    to: /docs/websocket
  - title: Plugins
    description: Hook into the server lifecycle from the plugins/ directory.
    icon: i-lucide-plug
    to: /docs/plugins
  - title: OpenAPI
    description: A spec generated from your handlers, served through Scalar or Swagger UI.
    icon: i-lucide-file-json
    badge: Experimental
    to: /docs/openapi
  - title: Assets
    description: Public files served directly, server assets readable at runtime.
    icon: i-lucide-image
    to: /docs/assets
  - title: Renderer
    description: A catch-all handler for unmatched routes — SSR, SPA shells or plain HTML.
    icon: i-lucide-layout-template
    to: /docs/renderer
  - title: Lifecycle
    description: Every layer a request passes through, in order, and where to intercept it.
    icon: i-lucide-activity
    to: /docs/lifecycle
---
::

::call-to-action{command="create-nitro-app"}
#title
Start with one command

#description
Scaffold a project, or add the Vite plugin to the app you already have.

#actions
:app-hero-links
::

::sponsors
