---
category: server side rendering
icon: i-lucide-brackets
---

# Mono JSX

> Server-side JSX rendering in Nitro with mono-jsx.

<!-- automd:ui-code-tree src="." default="server.tsx" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server.tsx" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build"
  },
  "devDependencies": {
    "mono-jsx": "latest",
    "nitro": "latest"
  }
}
```

```tsx [server.tsx]
export default () => (
  <html>
    <h1>Nitro + mongo-jsx works!</h1>
  </html>
);
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx"
  }
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

::

<!-- /automd -->

<!-- automd:file src="GUIDE.md" -->

## Server Entry

```tsx [server.tsx]
export default () => (
  <html>
    <h1>Nitro + mongo-jsx works!</h1>
  </html>
);
```

Nitro auto-detects `server.tsx` and uses mono-jsx to transform JSX into HTML. Export a function that returns JSX, and Nitro sends the rendered HTML as the response.

<!-- /automd -->

## Learn More

- [Renderer](/docs/renderer)
- [mono-jsx](https://github.com/aspect-dev/mono-jsx)
