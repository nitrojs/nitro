---
icon: simple-icons:bun
---

# Bun

> Run Nitro apps with Bun runtime.

**Preset:** `bun`

Nitro output is compatible with the Bun runtime. While the default [Node.js](/deploy/runtimes/node) output also runs in Bun, building with the `bun` preset enables Bun-specific optimizations.

After building with the `bun` preset, start the production server with:

```bash
bun run ./.output/server/index.mjs
```

## Environment Variables

You can customize server behavior with the following environment variables:

- `NITRO_BUN_IDLE_TIMEOUT` - Bun's server [idleTimeout](https://bun.sh/docs/api/http#idletimeout) in seconds. Must be between `0` and `255`, where `0` disables the timeout. Invalid values are ignored and Bun's default is used.

```bash
NITRO_BUN_IDLE_TIMEOUT=30 bun run ./.output/server/index.mjs
```

:read-more{to="https://bun.sh"}
