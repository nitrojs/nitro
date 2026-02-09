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

### Environment Variables

You can customize server behavior using following environment variables:

- `NITRO_PORT` or `PORT` (defaults to `3000`)
- `NITRO_HOST` or `HOST`
- `NITRO_SSL_CERT` and `NITRO_SSL_KEY` - if both are present, this will launch the server in HTTPS mode. In the vast majority of cases, this should not be used other than for testing, and the Nitro server should be run behind a reverse proxy like nginx or Cloudflare which terminates SSL.
- `NITRO_SHUTDOWN_DISABLED` - Disables the graceful shutdown feature when set to `'true'`. Defaults to `'false'`.
- `NITRO_SHUTDOWN_TIMEOUT` - Sets the amount of time (in milliseconds) before a forced shutdown occurs. Defaults to `3000` milliseconds.

## Deno Deploy

:read-more{to="/deploy/providers/deno-deploy"}
