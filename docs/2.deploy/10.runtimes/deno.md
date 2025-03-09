---
icon: simple-icons:deno
---

# Deno

> Run Nitro apps with [Deno](https://deno.com/) runtime.

**Preset:** `deno_server`

You can build your Nitro server using Node.js to run within [Deno Runtime](https://deno.com/runtime) in a custom server.

```bash
# Build with the deno NITRO preset
NITRO_PRESET=deno_server npm run build

# Start production server
deno run --unstable --allow-net --allow-read --allow-env .output/server/index.ts
```

To enabling Node.js compatibility, you need to upgrade to Deno v2, and a compatibility date set to `2025-01-30` or later in your nitro configuration file.

::code-group

```ts [nitro.config.ts]
export default defineNitroConfig({
    compatibilityDate: "2025-01-30",
})
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
    compatibilityDate: "2025-01-30",
})
```

::

## Deno Deploy

:read-more{to="/deploy/providers/deno-deploy"}
