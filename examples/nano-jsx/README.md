---
category: rendering
---

# Nano JSX

> Server-side JSX rendering in Nitro with nano-jsx.

<!-- automd:dir-tree -->

```
├── nitro.config.ts
├── package.json
├── README.md
├── server.tsx
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Server Entry

<!-- automd:file src="server.tsx" code -->

```tsx [server.tsx]
import { defineHandler, html } from "h3";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Nitro + nano-jsx works!</h1>));
});
```

<!-- /automd -->

Nitro auto-detects `server.tsx` and uses it as the server entry. Use `renderSSR` from nano-jsx to convert JSX into an HTML string. The `html` helper from H3 sets the correct content type header.

## Learn More

- [Renderer](/docs/renderer)
- [nano-jsx](https://nanojsx.io/)
