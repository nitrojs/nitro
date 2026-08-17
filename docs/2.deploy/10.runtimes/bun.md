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

## Idle Timeout

Set `NITRO_BUN_IDLE_TIMEOUT` to change Bun's server idle timeout. The value is in seconds and must be between `0` and `255`. Setting it to `0` disables the idle timeout.

```bash
NITRO_BUN_IDLE_TIMEOUT=30 bun run ./.output/server/index.mjs
```

:read-more{to="https://bun.sh"}
