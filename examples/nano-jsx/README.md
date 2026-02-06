---
category: server side rendering
icon: i-lucide-brackets
---

# Nano JSX

> Server-side JSX rendering in Nitro with nano-jsx.

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
    "nano-jsx": "^0.2.1",
    "nitro": "latest"
  }
}
```

```tsx [server.tsx]
import { defineHandler, html } from "h3";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Nitro + nano-jsx works!</h1>));
});
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "nano-jsx/esm"
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
import { defineHandler, html } from "h3";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Nitro + nano-jsx works!</h1>));
});
```

Nitro auto-detects `server.tsx` and uses it as the server entry. Use `renderSSR` from nano-jsx to convert JSX into an HTML string. The `html` helper from H3 sets the correct content type header.

<!-- /automd -->

## Learn More

- [Renderer](/docs/renderer)
- [nano-jsx](https://nanojsx.io/)
