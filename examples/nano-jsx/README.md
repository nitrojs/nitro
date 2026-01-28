---
category: rendering
---

# Nano JSX

> Lightweight JSX rendering with nano-jsx.

## Project Structure

```
nano-jsx/
├── server.tsx            # JSX server entry
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Use nano-jsx for server-side JSX rendering:

```tsx [server.tsx]
import { defineHandler, html } from "h3";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Nitro + nano-jsx works!</h1>));
});
```

## Learn More

- [nano-jsx Documentation](https://nanojsx.io/)
- [Renderer](/docs/renderer)
