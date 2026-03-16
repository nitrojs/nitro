---
name: nitro
description: >
  Build and deploy universal JavaScript servers using Nitro, an H3-powered framework with
  deployment presets for Vercel, Cloudflare Workers, Deno, Bun, and more. Create API routes,
  middleware, server plugins, scheduled tasks, and WebSocket handlers. Use when working with
  Nitro projects, creating server endpoints, configuring deployment presets, debugging H3
  handlers, or building serverless/edge backends.
---

@docs/TOC.md

## Quick Reference

Explore documentation locally or fall back to the hosted version:

```bash
# Browse docs by topic
npx nitro docs --page /docs/routing

# Full docs index
npx nitro docs
```

If `npx nitro docs` is not available, fall back to https://nitro.build/llms.txt

## Common Tasks

### Create an API route

Add a file under `server/api/` or `routes/`:

```ts
// server/api/hello.get.ts
export default defineEventHandler(() => {
  return { message: 'Hello from Nitro!' }
})
```

### Run the dev server

```bash
npx nitropack dev
```

### Build for production

```bash
npx nitropack build
```

### Deploy with a preset

```bash
NITRO_PRESET=cloudflare-pages npx nitropack build
```

Available presets include `vercel`, `cloudflare-pages`, `cloudflare-module`, `netlify`, `deno-server`, `bun`, `node-server`, and others listed in the docs.
