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

:read-more{to="https://bun.sh"}
