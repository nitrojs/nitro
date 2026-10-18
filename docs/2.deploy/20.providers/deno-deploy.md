# Deno Deploy

> Deploy Nitro apps to [Deno Deploy](https://deno.com/deploy).

**Preset:** `deno_server`

:read-more{title="Deno Deploy" to="https://docs.deno.com/deploy/"}

::warning
Deno Deploy will shut down in 2027 as the Deno team joins Cloudflare ([announcement](https://deno.com/blog/cloudflare)). Consider deploying to [Cloudflare](/deploy/providers/cloudflare) instead.
::

## Deploy with a linked GitHub repository

Deno Deploy runs the output of the [Deno](/deploy/runtimes/deno) runtime preset.

1. Create a new app on [Deno Deploy](https://console.deno.com) and link your GitHub repository.
2. Set the **Build command** to build with the `deno_server` preset (for example, `NITRO_PRESET=deno_server npm run build`).
3. Choose the **Dynamic** runtime configuration and set the **Entrypoint** to `.output/server/index.mjs`.

Every push to your repository will then trigger a new build and deployment.

::note
The `deno_deploy` preset targeted Deno Deploy Classic, which shut down on July 20, 2026. In Nitro v3, `deno_deploy` is an alias of `deno_server`.
::
