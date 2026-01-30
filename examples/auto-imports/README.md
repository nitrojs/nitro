---
category: config
icon: i-lucide-import
---

# Auto Imports

> Automatic imports for utilities and composables.

<!-- automd:ui-code-tree src="." default="nitro.config.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="nitro.config.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: true,
  imports: {},
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
import { defineHandler } from "nitro/h3";
import { makeGreeting } from "./server/utils/hello.ts";

export default defineHandler(() => `<h1>${makeGreeting("Nitro")}</h1>`);
```

```json [tsconfig.json]
{
  "include": [".nitro/types/nitro-imports.d.ts", "src"]
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

```ts [server/utils/hello.ts]
export function makeGreeting(name: string) {
  return `Hello, ${name}!`;
}
```

::

<!-- /automd -->

Functions exported from `server/utils/` are automatically available without explicit imports when auto-imports are enabled. Define a utility once and use it anywhere in your server code.

## Configuration

Enable auto-imports by setting `imports` in your config:

<!-- automd:file src="nitro.config.ts" code -->

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: true,
  imports: {},
});
```

<!-- /automd -->

## Using Auto Imports

1. Create a utility file in `server/utils/`:

<!-- automd:file src="server/utils/hello.ts" code -->

```ts [hello.ts]
export function makeGreeting(name: string) {
  return `Hello, ${name}!`;
}
```

<!-- /automd -->

2. The function is available without importing it:

<!-- automd:file src="server.ts" code -->

```ts [server.ts]
import { defineHandler } from "nitro/h3";
import { makeGreeting } from "./server/utils/hello.ts";

export default defineHandler(() => `<h1>${makeGreeting("Nitro")}</h1>`);
```

<!-- /automd -->

With this setup, any function exported from `server/utils/` becomes globally available. Nitro scans the directory and generates the necessary imports automatically.

## Learn More

- [Configuration](/docs/configuration)
