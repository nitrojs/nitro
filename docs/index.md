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
  filename: vite.config.mjs
  icon: i-logos-vitejs
  ---
  ```ts
  import { defineConfig } from "vite";
  import { nitro } from "nitro/vite";

  export default defineConfig({
    plugins: [
      nitro()
    ],
  });
  ```
  :::
  :::prose-pre
  ---
  filename: nitro.config.ts
  ---
  ```ts
  import { defineNitroConfig } from "nitro/config";

  export default defineNitroConfig({
    routeRules: {
      '/': { prerender: true },
      '/blog/**': { swr: 60 * 60 },
    }
  });
  ```
  :::
::

#title
Ship [Full-Stack]{.text-primary} Vite Apps

#description
Nitro extends your Vite application with a production-ready server, compatible with any runtime. Add server routes to your application and deploy many hosting platform with a zero-config experience.

#links
  :::u-button
  ---
  size: xl
  to: /docs
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

::div{class="bg-neutral-50 dark:bg-neutral-950 py-10"}
  ::u-container
    ::u-page-grid
      ::u-page-feature
      #title
      Fast

      #description
      Enjoy the Vite development experience with HMR on the server and optimized for production.
      ::

      ::u-page-feature
      #title
      Versatile

      #description
      Deploy the same codebase to any deployment provider with zero config, no vendor lock-in.
      ::

      ::u-page-feature
      #title
      Minimal

      #description
      Minimal design to fit into any solution with minimum overhead.
      ::
    ::
  ::
::

::u-page-section
---
orientation: horizontal
features:
  - title: 'server.ts'
    description: 'Go full Web standard and pick H3, Hono or Elysia to create server routes using the server.ts file.'
    icon: 'i-lucide-file-code'
  - title: 'server/'
    description: 'Create server routes in the server/ folder and they will be automatically registered.'
    icon: 'i-lucide-folder-tree'
---
#title
Create Server Routes

#description
Start creating API routes in the server/ folder or start with your favorite backend framework in a server.ts file.

#default
::tabs{class="h-[300px]"}
  ::tabs-item{label="Web Standard"}
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
  ::tabs-item{label="H3"}
    ::prose-pre{filename="server.ts"}
    ```ts
    import { H3 } from "h3";

    const app = new H3()

    app.get("/**", () => "⚡️ Hello from H3!");

    export default app;
    ```
    ::
  ::
  ::tabs-item{label="Hono"}
    ::prose-pre{filename="server.ts"}
    ```ts
    import { Hono } from "hono";

    const app = new Hono();

    app.get("/*", (c) => c.text("🔥 Hello from Hono!"));

    export default app;
    ```
    ::
  ::
  ::tabs-item{label="Server Directory"}
    ::code-tree{defaultValue="routes/hello.ts" expand-all}
      ::prose-pre{filename="vite.config.mjs"}
      ```ts
      import { defineConfig } from "vite";
      import { nitro } from "nitro/vite";

      export default defineConfig({
        plugins: [
          nitro()
        ],
      });
      ```
      ::
      ::prose-pre{filename="routes/api/hello.ts"}
      ```ts
      export default {
        async fetch(req: Request): Promise<Response> {
          return new Response("Hello from /api/hello");
        },
      };
      ```
      ::
      ::prose-pre{filename="routes/foo.ts"}
      ```ts
      export default defineHandler((event) => {
        return "Hello from /foo";
      });
      ```
      ::
    ::
  ::
::
