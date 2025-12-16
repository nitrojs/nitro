---
icon: simple-icons:bun
---

# Bun

> Run Nitro apps with Bun runtime.

**Preset:** `bun`

Nitro output is compatible with Bun runtime. While using default [Node.js](/deploy/runtimes/node) you can also run the output in bun, using `bun` preset has advantage of better optimizations.

After building with bun preset using `bun` as preset, you can run server in production using:

```bash
bun run ./.output/server/index.mjs
```

:read-more{to="https://bun.sh"}

## Environment Variables

You can use the `PORT` or `NITRO_PORT` environment variables to set the server port.

Use the `NITRO_BUN_IDLE_TIMEOUT` environment variable to change the default [idleTimeout](https://bun.sh/docs/runtime/http/server#idletimeout).
