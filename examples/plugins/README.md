---
category: features
icon: i-lucide-plug
---

# Plugins

> Extend Nitro with custom plugins for hooks and lifecycle events.

<!-- automd:ui-code-tree src="." default="server/plugins/test.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server/plugins/test.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: true,
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build"
  },
  "devDependencies": {
    "nitro": "latest"
  }
}
```

```ts [server.ts]
import { eventHandler } from "h3";

export default eventHandler(() => "<h1>Hello Nitro!</h1>");
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

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

::

<!-- /automd -->

<!-- automd:file src="GUIDE.md" -->

Plugins let you hook into Nitro's runtime lifecycle. This example shows a plugin that modifies the `Content-Type` header on every response. Create files in `server/plugins/` and they're automatically loaded at startup.

## Defining a Plugin

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

The plugin uses `useNitroHooks()` to access the hooks system, then registers a `response` hook that runs after every request. Here it sets the content type to HTML, but you could log requests, add security headers, or modify responses in any way.

## Main Handler

```ts [server.ts]
import { eventHandler } from "h3";

export default eventHandler(() => "<h1>Hello Nitro!</h1>");
```

The handler returns HTML without setting a content type. The plugin automatically adds the correct `Content-Type: html; charset=utf-8` header to the response.

<!-- /automd -->

## Learn More

- [Plugins](/docs/plugins)
- [Lifecycle](/docs/lifecycle)
