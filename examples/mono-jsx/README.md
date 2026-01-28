---
category: rendering
---

# Mono JSX

> Lightweight JSX rendering with mono-jsx.

## Project Structure

```
mono-jsx/
├── server.tsx            # JSX server entry
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Use JSX syntax directly in your server entry:

```tsx [server.tsx]
export default () => (
  <html>
    <h1>Nitro + mono-jsx works!</h1>
  </html>
);
```

## Learn More

- [Renderer](/docs/renderer)
