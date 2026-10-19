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

[Deno Deploy](https://deno.com/deploy) runs the output of the `deno_server` preset.

:read-more{title="Deno Deploy" to="https://docs.deno.com/deploy/"}

::warning
Deno Deploy will shut down in 2027 as the Deno team joins Cloudflare ([announcement](https://deno.com/blog/cloudflare)).
::

1. Create a new app on [Deno Deploy](https://console.deno.com) and link your GitHub repository.
2. Set the **Build command** to build with the `deno_server` preset (for example, `NITRO_PRESET=deno_server npm run build`).
3. Choose the **Dynamic** runtime configuration and set the **Entrypoint** to `.output/server/index.mjs`.

Every push to your repository will then trigger a new build and deployment.

::note
The `deno_deploy` preset targeted Deno Deploy Classic, which shut down on July 20, 2026, and has been removed in Nitro v3. Use the `deno_server` preset instead.
::
