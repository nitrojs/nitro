# Standard

> Run Nitro apps on any runtime with a web-standard entry.

**Preset:** `standard`

The `standard` preset produces a portable, runtime-agnostic build with a web-standard entry. The server entry default-exports an object with a [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) handler, compatible with any runtime or platform that supports the web-standard server convention.

```bash
# Build with the standard preset
NITRO_PRESET=standard npm run build
```

The generated entry looks like this:

```js [.output/server/index.mjs]
export default {
  fetch(request) {
    // ...
  }
}
```

## Preview

You can locally preview the output using [srvx](https://srvx.h3.dev):

```bash
cd .output
npx srvx --prod ./
```

::note
With this preset, the server does not serve static assets. Public assets are emitted to the `public/` directory of the build output and should be served by the hosting platform or a separate static file server.
::
