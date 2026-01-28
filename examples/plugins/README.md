---
category: features
---

# Plugins

> Extend Nitro with custom plugins for hooks and lifecycle events.

## Project Structure

```
plugins/
├── server/
│   └── plugins/
│       └── test.ts       # Custom plugin
├── server.ts             # Main handler
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Plugins let you hook into Nitro's lifecycle. Create files in `server/plugins/`:

```ts [server/plugins/test.ts]
import { definePlugin } from "nitro";
import { useNitroHooks } from "nitro/app";

export default definePlugin((nitroApp) => {
  const hooks = useNitroHooks();

  hooks.hook("response", (event) => {
    event.headers.set("content-type", "html; charset=utf-8");
  });
});
```

## Learn More

- [Plugins](/docs/plugins)
- [Lifecycle](/docs/lifecycle)
