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

## Importing from npm and JSR

Deno resolves `npm:` and `jsr:` specifiers itself, so Nitro leaves them out of the bundle. Pin a version, since the specifier is all Deno has to go on:

```ts
import { escape } from "npm:lodash-es@4.17.21";
import { encodeHex } from "jsr:@std/encoding@1/hex";
```

Bare specifiers (`lodash-es`) are bundled as usual.

## Deno Deploy

:read-more{to="/deploy/providers/deno-deploy"}
