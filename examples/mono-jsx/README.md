---
category: server side rendering
icon: i-lucide-brackets
defaultFile: server.tsx
---

# Mono JSX

> Server-side JSX rendering in Nitro with mono-jsx.

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
export default () => (
  <html>
    <h1>Nitro + mongo-jsx works!</h1>
  </html>
);
```

<!-- /automd -->

Nitro auto-detects `server.tsx` and uses mono-jsx to transform JSX into HTML. Export a function that returns JSX, and Nitro sends the rendered HTML as the response.

## Learn More

- [Renderer](/docs/renderer)
- [mono-jsx](https://github.com/aspect-dev/mono-jsx)
