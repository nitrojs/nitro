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

## Idle Timeout

Set `NITRO_BUN_IDLE_TIMEOUT` to change Bun's server idle timeout. The value is in seconds and must be between `0` and `255`. Setting it to `0` disables the idle timeout.

```bash
NITRO_BUN_IDLE_TIMEOUT=30 bun run ./.output/server/index.mjs
```

:read-more{to="https://bun.sh"}
