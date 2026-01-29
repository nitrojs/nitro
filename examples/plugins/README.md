---
category: features
icon: i-lucide-plug
defaultFile: server/plugins/test.ts
---

# Plugins

> Extend Nitro with custom plugins for hooks and lifecycle events.

Plugins let you hook into Nitro's runtime lifecycle. This example shows a plugin that modifies the `Content-Type` header on every response. Create files in `server/plugins/` and they're automatically loaded at startup.

<!-- automd:dir-tree -->

```
├── server/
│   └── plugins/
│       └── test.ts
├── nitro.config.ts
├── package.json
├── README.md
├── server.ts
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Defining a Plugin

<!-- automd:file src="server/plugins/test.ts" code -->

```ts [test.ts]
import { definePlugin } from "nitro";
import { useNitroHooks } from "nitro/app";

export default definePlugin((nitroApp) => {
  const hooks = useNitroHooks();
  hooks.hook("response", (event) => {
    event.headers.set("content-type", "html; charset=utf-8");
  });
});
```

<!-- /automd -->

The plugin uses `useNitroHooks()` to access the hooks system, then registers a `response` hook that runs after every request. Here it sets the content type to HTML, but you could log requests, add security headers, or modify responses in any way.

## Main Handler

<!-- automd:file src="server.ts" code -->

```ts [server.ts]
import { eventHandler } from "h3";

export default eventHandler(() => "<h1>Hello Nitro!</h1>");
```

<!-- /automd -->

The handler returns HTML without setting a content type. The plugin automatically adds the correct `Content-Type: html; charset=utf-8` header to the response.

## Learn More

- [Plugins](/docs/plugins)
- [Lifecycle](/docs/lifecycle)
