# Documentation Guide

## Structure

Documentation lives in `docs/` and is built with [UnDocs](https://github.com/unjs/undocs).

```
docs/
  .docs/          # UnDocs Nuxt app (components, pages, layouts, utils)
  .config/        # docs.yaml (site config), automd.config.ts
  1.docs/         # Core documentation (getting started, routing, cache, etc.)
  2.deploy/       # Deployment docs (runtimes, providers)
  3.config/       # Config reference
  4.examples/     # Examples index
  index.md        # Homepage
```

Numeric prefixes control navigation order. Files with the same prefix are sorted alphabetically.

## Conventions

### Preset Names

Canonical preset names use **underscores** (e.g., `node_server`, `cloudflare_module`, `digital_ocean`). Both underscores and hyphens are supported at runtime (resolved via `kebabCase`), but docs should use underscore form.

### Import Paths

Nitro v3 uses subpath exports — not deep runtime imports:

```ts
import { defineHandler, readBody, getQuery } from "nitro/h3";
import { defineCachedHandler, defineCachedFunction } from "nitro/cache";
import { useStorage } from "nitro/storage";
import { useDatabase } from "nitro/database";
import { useRuntimeConfig } from "nitro/runtime-config";
import { defineNitroConfig } from "nitro/config";
import { definePlugin } from "nitro";        // runtime plugin
import { defineRouteMeta } from "nitro";      // route meta macro
```

### H3 v2 API

Nitro v3 uses H3 v2. Key differences from v1:

- **Handler**: `defineHandler()` (not `eventHandler` / `defineEventHandler`)
- **Error**: `throw new HTTPError(message, { status })` (not `createError()`)
- **Router**: `new H3()` (not `createApp()` / `createRouter()`)
- **Response**: Return values directly; no `send()` function
- **Headers**: `event.res.headers.set(name, value)` (not `setResponseHeader(event, name, value)`)
- **Hooks**: `request` hook receives `(event: HTTPEvent)`, not `(req)`

### Code Examples

- **Auto imports are not available** — always show explicit imports in examples
- Always use `defineHandler` from `"nitro/h3"` (not `eventHandler`)
- Always use `defineNitroConfig` from `"nitro/config"` (not `defineConfig`)
- Include import statements in code examples
- Use `"nitro/*"` imports, never `"nitropack/*"`

### Node.js Version

Nitro v3 requires Node.js >= 20. All deployment docs should reference Node.js 20+ (not 16 or 18).

### Environment Variables

The preset env var is `NITRO_PRESET` (not `SERVER_PRESET` or any other name).

### Runtime Config

- Prefix: `NITRO_` for env var overrides
- camelCase in config, UPPER_SNAKE_CASE in env vars

## Common Mistakes to Avoid

- Using `send(event, value)` — removed in h3 v2, return values directly
- Using `createError()` — use `new HTTPError()` or `HTTPError.status()`
- Using `eventHandler()` — use `defineHandler()`
- Using `defineConfig()` for nitro config — use `defineNitroConfig()`
- Duplicate imports (e.g., importing `defineHandler` from both `nitro/h3` and `nitro/cache`)
- Wrong env var names (e.g., `NITR_PRESET`, `SERVER_PRESET`)
- Outdated Node.js versions in deployment examples
- Using hyphen preset names in docs (use underscores)
