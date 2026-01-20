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
    plugins: [
      nitro()
    ],
    nitro: {
      preset: 'standard'
    }
  })
  ```
  :::
::

:hero-background

#title
Ship [Full-Stack]{.text-primary} Vite Apps

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

::u-page-section
---
orientation: horizontal
features:
  - title: 'routes/'
    description: 'Create server routes in the routes/ folder and they will be automatically registered.'
    icon: 'i-lucide-folder-tree'
  - title: 'server.ts'
    description: 'Go full Web standard and pick standard library of your choice to create server routes using the server.ts file.'
    icon: 'i-lucide-file-code'
---
#title
Create Server Routes

#description
Start creating API routes in the routes/ folder or start with your favorite backend framework in a `server.ts` file.

#default
::div{class="min-h-[506px]"}
  ::tabs
    ::tabs-item{label="FS Routing" icon="i-lucide-folder"}
      ::code-tree{defaultValue="routes/hello.ts" expand-all}
        ::prose-pre{filename="vite.config.ts"}
        ```ts
        import { defineConfig } from 'vite'
        import { nitro } from 'nitro/vite'

        export default defineConfig({
          plugins: [
            nitro()
          ],
        });
        ```
        ::
        ::prose-pre{filename="routes/hello.ts"}
        ```ts
        import { defineHandler } from 'nitro/h3'

        export default defineHandler(({ req }) => {
          return { api: 'works!' }
        })
        ```
        ::
        ::prose-pre{filename="index.html"}
        ```html
          <html>
          <head>
            <title>Nitro + Vite</title>
          </head>
          <body>
            <h1>Hey, there!</h1>
          </body>
          </html>
        ```
        ::
      ::
    ::
    ::tabs-item{label="Web Standard" icon="i-lucide-globe"}
      ::prose-pre{filename="server.ts"}
      ```ts
      export default {
        async fetch(req: Request): Promise<Response> {
          return new Response(`Hello world! (${req.url})`);
        },
      };
      ```
      ::
    ::
    ::tabs-item{label="H3" icon="i-undocs-h3"}
      ::prose-pre{filename="server.ts"}
      ```ts
      import { H3 } from 'h3'

      const app = new H3()

      app.get("/", () => '⚡️ Hello from H3!')

      export default app
      ```
      ::
    ::
    ::tabs-item{label="Hono" icon="i-undocs-hono"}
      ::prose-pre{filename="server.ts"}
      ```ts
      import { Hono } from 'hono'

      const app = new Hono()

      app.get("/", (c) => c.text('🔥 Hello from Hono!'))

      export default app
      ```
      ::
    ::
    ::tabs-item{label="Elysia" icon="i-undocs-elysia"}
      ::prose-pre{filename="server.ts"}
      ```ts
      import { Elysia } from 'elysia'

      const app = new Elysia()

      app.get("/", (c) => '🦊 Hello from Elysia!')

      export default app
      ```
      ::
    ::
  ::
::
::

:page-sponsors

:page-contributors
