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

## Cluster mode

**Preset:** `bun_cluster`

For more performance and leveraging multi-core handling, you can use cluster preset.

> [!IMPORTANT]
Linux only - this preset only works on linux.
Refer to the [bun docs](https://bun.sh/guides/http/cluster) for more info.

### Environment Variables

- `NITRO_CLUSTER_WORKERS`: Number of cluster workers (default is number of logical processors available - [Hardware Concurrency](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency))

:read-more{to="https://bun.sh"}
