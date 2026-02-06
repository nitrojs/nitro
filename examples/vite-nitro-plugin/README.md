---
category: vite
icon: i-logos-vitejs
---

# Vite Nitro Plugin

> Use Nitro as a Vite plugin for programmatic configuration.

<!-- automd:ui-code-tree src="." default="vite.config.mjs" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="vite.config.mjs" expandAll}

```json [package.json]
{
  "type": "module",
  "scripts": {
    "build": "vite build",
    "preview": "vite preview",
    "dev": "vite dev"
  },
  "devDependencies": {
    "nitro": "latest",
    "vite": "beta"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```js [vite.config.mjs]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro(),
    {
      name: "my-nitro-plugin",
      nitro: {
        setup: (nitro) => {
          nitro.options.routes["/"] = "#virtual-by-plugin";
          nitro.options.virtual["#virtual-by-plugin"] =
            `export default () => new Response("Hello from virtual entry!")`;
        },
      },
    },
  ],
});
```

::

<!-- /automd -->

<!-- automd:file src="GUIDE.md" -->

Instead of using a separate `nitro.config.ts`, you can configure Nitro directly in your Vite config. This gives you access to Nitro's setup hook where you can register routes and virtual modules programmatically.

## Vite Configuration

```js [vite.config.mjs]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro(),
    {
      name: "my-nitro-plugin",
      nitro: {
        setup: (nitro) => {
          nitro.options.routes["/"] = "#virtual-by-plugin";
          nitro.options.virtual["#virtual-by-plugin"] =
            `export default () => new Response("Hello from virtual entry!")`;
        },
      },
    },
  ],
});
```

The config adds two plugins: the `nitro()` plugin and a custom plugin that uses the `nitro.setup` hook. Inside the setup function, you have access to Nitro's options object. This example registers a virtual route at `/` that maps to a virtual module `#virtual-by-plugin`, then defines that module inline.

<!-- /automd -->

## Learn More

- [Configuration](/docs/configuration)
