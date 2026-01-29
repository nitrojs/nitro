---
category: vite
icon: i-logos-vitejs
defaultFile: vite.config.mjs
---

# Vite Nitro Plugin

> Use Nitro as a Vite plugin for programmatic configuration.

Instead of using a separate `nitro.config.ts`, you can configure Nitro directly in your Vite config. This gives you access to Nitro's setup hook where you can register routes and virtual modules programmatically.

<!-- automd:dir-tree -->

```
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.mjs
```

<!-- /automd -->

## Vite Configuration

<!-- automd:file src="vite.config.mjs" code -->

```mjs [vite.config.mjs]
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

<!-- /automd -->

The config adds two plugins: the `nitro()` plugin and a custom plugin that uses the `nitro.setup` hook. Inside the setup function, you have access to Nitro's options object. This example registers a virtual route at `/` that maps to a virtual module `#virtual-by-plugin`, then defines that module inline.

## Learn More

- [Configuration](/docs/configuration)
