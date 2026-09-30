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

## Static assets

Edge Scripting runs a single-file script, so this preset builds with `serveStatic: "inline"`: public assets are embedded in the bundle and `.output/public` is deleted after the build.

Bunny caps scripts at 10MB. If your public assets push the bundle past that limit, disable static serving and host them elsewhere (for example [Bunny Storage](https://bunny.net/storage) behind a pull zone):

```ts [nitro.config.ts]
export default defineNitroConfig({
  serveStatic: false,
});
```

With `serveStatic: false` the assets are left in `.output/public` for you to upload separately. Any other value is overridden back to `"inline"`.

:read-more{title="Bunny Edge Scripting limits" to="https://docs.bunny.net/scripting/limits"}

## Node.js compatibility

Edge Scripting runs on Deno, but cannot resolve every Node.js built-in. This preset builds with `node: false` and externalizes only the built-ins Bunny resolves; the rest (`node:worker_threads`, `node:child_process`, `node:vm`, `node:v8`, ...) are replaced with an [unenv](https://github.com/unjs/unenv) stub, since importing one of them stops the script from loading.

Stubs do not throw on import, so code paths depending on those modules fail only when reached. Bunny also documents that resolvable modules may be partially stubbed on their side, so prefer Web APIs where possible.

## Importing from npm and JSR

Edge Scripting resolves `npm:` and `jsr:` specifiers itself, so they are left out of the bundle and fetched at deploy time. Pin a version, since the specifier is all Bunny has to go on:

```ts
import { escape } from "npm:lodash-es@4.17.21";
import { encodeHex } from "jsr:@std/encoding@1/hex";
```

This keeps large dependencies out of the 10MB script limit. Bare specifiers (`lodash-es`) are bundled as usual.
