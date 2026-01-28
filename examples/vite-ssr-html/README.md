---
category: vite
---

# Vite SSR HTML

> Server-side rendering HTML with Vite and Nitro.

## Project Structure

```
vite-ssr-html/
├── app/
│   └── entry-server.ts    # Server-side entry point
├── routes/
│   └── quote.ts           # API route example
├── index.html             # HTML template
├── vite.config.ts
└── nitro.config.ts
```

## How It Works

The `app/entry-server.ts` file exports a render function that Nitro calls to generate HTML:

```ts [app/entry-server.ts]
export default async function render(url: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
  </head>
  <body>
    <h1>Server Rendered Content</h1>
  </body>
</html>`
}
```

## Learn More

- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
