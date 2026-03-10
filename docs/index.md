---
seo:
  title: Ship Full-Stack Vite Apps
  description: Nitro extends your Vite application with a production-ready server, compatible with any runtime. Add server routes to your application and deploy many hosting platform with a zero-config experience.
---

::u-page-hero
---
orientation: horizontal
---
::code-group
  :::prose-pre
  ---
  filename: vite.config.ts
  ---
  ```ts
  import { defineConfig } from 'vite'
  import { nitro } from 'nitro/vite'

  export default defineConfig({
    plugins: [nitro()],
    nitro: {
      serverDir: "./server"
    }
  })
  ```
  :::
  :::prose-pre
  ---
  filename: nitro.config.ts
  ---
  ```ts
  import { defineConfig } from 'nitro'

  export default defineConfig({
    serverDir: './server'
  })
  ```
  :::
::

:hero-background

#title
Run [Servers]{.text-primary} Anywhere

#description
Nitro extends your Vite application with a production-ready server, compatible with any runtime. Add server routes to your application and deploy many hosting platform with a zero-config experience.

#links
  :::u-button
  ---
  size: xl
  to: /docs/quick-start
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  icon: i-simple-icons-github
  size: xl
  target: _blank
  to: https://github.com/nitrojs/nitro
  variant: outline
  ---
  GitHub
  :::
::

::div{class="bg-neutral-50 dark:bg-neutral-950/30 py-10 border-y border-default"}
  :::u-container
    ::::u-page-grid
      :::::u-page-feature
      #title
      Fast

      #description
      Enjoy the Vite development experience with HMR on the server and optimized for production.
      :::::

      :::::u-page-feature
      #title
      Versatile

      #description
      Deploy the same codebase to any deployment provider with zero config, no vendor lock-in.
      :::::

      :::::u-page-feature
      #title
      Minimal

      #description
      Minimal design to fit into any solution with minimum overhead.
      :::::
    ::::
  :::
::

::landing-features
#body
  :::feature-card
  ---
  headline: Routing
  link: /docs/routing
  link-label: Routing docs
  ---
  #title
  File-system routing

  #description
  Create server routes in the routes/ folder and they are automatically registered. Or bring your own framework — H3, Hono, Elysia, Express — via a server.ts entry.
  :::

  :::feature-card
  ---
  headline: Versatile
  link: /deploy
  link-label: Explore deploy targets
  ---
  #title
  Deploy everywhere

  #description
  The same codebase deploys to Node.js, Cloudflare Workers, Deno, Bun, AWS Lambda, Vercel, Netlify, and more — zero config, no vendor lock-in.
  :::

  :::feature-card
  ---
  headline: Storage
  link: /docs/storage
  link-label: Storage docs
  ---
  #title
  Universal storage

  #description
  Built-in key-value storage abstraction powered by unstorage. Works with filesystem, Redis, Cloudflare KV, and more — same API everywhere.
  :::

  :::feature-card
  ---
  headline: Caching
  link: /docs/cache
  link-label: Caching docs
  ---
  #title
  Built-in caching

  #description
  Cache route handlers and arbitrary functions with a simple API. Supports multiple storage backends and stale-while-revalidate patterns.
  :::

  :::feature-card
  ---
  headline: Server Entry
  link: /docs/server-entry
  link-label: Server entry docs
  ---
  #title
  Web standard server

  #description
  Go full Web standard and pick the library of your choice. Use H3, Hono, Elysia, Express, or the raw fetch API — Nitro handles the rest.
  :::

  :::feature-card
  ---
  headline: Renderer
  link: /docs/renderer
  link-label: Renderer docs
  ---
  #title
  Universal renderer

  #description
  Use any frontend framework as your renderer. Nitro provides the server layer while your framework handles the UI.
  :::
::


::page-sponsors
