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

### Environment Variables

You can customize server behavior using following environment variables:

- `NITRO_PORT` or `PORT` (defaults to `3000`)
- `NITRO_HOST` or `HOST`
- `NITRO_UNIX_SOCKET` - if provided (a path to the desired socket file) the service will be served over the provided UNIX socket.
- `NITRO_SSL_CERT` and `NITRO_SSL_KEY` - if both are present, this will launch the server in HTTPS mode. In the vast majority of cases, this should not be used other than for testing, and the Nitro server should be run behind a reverse proxy like nginx or Cloudflare which terminates SSL.
- `NITRO_SHUTDOWN_DISABLED` - Disables the graceful shutdown feature when set to `'true'`. Defaults to `'false'`.
- `NITRO_SHUTDOWN_TIMEOUT` - Sets the amount of time (in milliseconds) before a forced shutdown occurs. Defaults to `3000` milliseconds.
