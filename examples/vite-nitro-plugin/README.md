---
category: vite
---

# Vite Nitro Plugin

> Use Nitro as a Vite plugin.

## Project Structure

```
vite-nitro-plugin/
├── vite.config.mjs       # Vite config with Nitro plugin
└── tsconfig.json
```

## How It Works

Add Nitro as a Vite plugin:

```ts [vite.config.mjs]
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

## Learn More

- [Configuration](/docs/configuration)
