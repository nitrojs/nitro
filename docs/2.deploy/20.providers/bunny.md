# Bunny

> Deploy Nitro apps to Bunny Edge Scripting.

**Preset:** `bunny`

:read-more{title="Bunny Edge Scripting" to="https://bunny.net/edge-scripting"}

## Deploy

Build your app with the `bunny` preset:

```bash
NITRO_PRESET=bunny npm run build
```

The build output is a single file at `.output/bunny-edge-scripting.mjs`. You can upload it to Bunny Edge Scripting either manually from the Bunny dashboard or via CI using Bunny's API.

:read-more{title="Bunny Scripting Docs" to="https://docs.bunny.net/scripting"}
