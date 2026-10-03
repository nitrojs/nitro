---
icon: simple-icons:deno
---

# Deno

> Run Nitro apps with [Deno](https://deno.com/) runtime.

**Preset:** `deno_server`

You can build your Nitro app to run within the [Deno runtime](https://deno.com/runtime) as a custom server.

```bash
# Build with the Deno preset
NITRO_PRESET=deno_server npm run build

# Start production server
deno run --allow-net --allow-read --allow-env .output/server/index.mjs
```

## Deno Deploy

:read-more{to="/deploy/providers/deno-deploy"}
