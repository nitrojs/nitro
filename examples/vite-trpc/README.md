---
category: vite
---

# Vite + tRPC

> End-to-end typesafe APIs with tRPC, Vite, and Nitro.

## Project Structure

```
vite-trpc/
├── server/
│   └── trpc.ts          # tRPC router and procedures
├── index.html           # Frontend entry
└── vite.config.ts
```

## How It Works

### tRPC Router

Define your API endpoints in `server/trpc.ts`:

```ts [server/trpc.ts]
import { initTRPC } from '@trpc/server'

const t = initTRPC.create()

export const appRouter = t.router({
  hello: t.procedure
    .input(z.string())
    .query(({ input }) => {
      return { greeting: `Hello ${input}!` }
    }),
})

export type AppRouter = typeof appRouter
```

### Client Usage

Use the router on the frontend with full type safety:

```ts [client.ts]
import { createTRPCClient } from '@trpc/client'
import type { AppRouter } from './server/trpc'

const client = createTRPCClient<AppRouter>({
  url: '/api/trpc',
})

const result = await client.hello.query('World')
```

## Learn More

- [tRPC Documentation](https://trpc.io/)
- [Routing](/docs/routing)
