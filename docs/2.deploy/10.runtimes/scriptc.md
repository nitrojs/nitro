# scriptc

> Compile Nitro apps to native executables with scriptc.

**Preset:** `scriptc`

::warning
This preset is experimental. [scriptc](https://scriptc.dev) is an experimental compiler, and only part of Nitro and of the npm ecosystem compiles with it today.
::

[scriptc](https://scriptc.dev) compiles TypeScript and JavaScript to native executables using LLVM, with no Node.js at runtime. The `scriptc` preset bundles the server into a single program that scriptc can compile, then compiles it to `.output/server/index`.

Install `scriptc` in your project (or set `SCRIPTC` to the path of the `scriptc` command), then build and start the server:

```bash
npm i -D scriptc

# Build and compile with the scriptc preset
NITRO_PRESET=scriptc npm run build

# Start the native server
./.output/server/index
```

If `scriptc` is not found, or its install script did not run (pnpm and bun block install scripts by default), the build only warns and prints the command to compile `.output/server/index.mjs` manually. A failed compile fails the build.

The executable embeds the public assets (`serveStatic: "inline"`), so `.output/server/index` can be copied or moved on its own.

The bundle also runs with Node.js (`node .output/server/index.mjs`). `nitro preview` runs this bundle with Node.js, not the executable: start `.output/server/index` directly to test the native build.

## Options

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  preset: "scriptc",
  scriptc: {
    // Set to `false` to skip compiling after the build
    compile: true,
    // Additional arguments for `scriptc build`
    args: ["--strip"],
  },
});
```

## Environment Variables

- `NITRO_PORT` or `PORT` (defaults to `3000`)
- `NITRO_HOST` or `HOST`

## Limitations

The preset includes an HTTP/1.1 server for scriptc's `node:http`, and patches Nitro, h3 and other bundled libraries at build time where scriptc can't compile them yet. Some features still don't work:

- `event.req.ip`, `event.req.waitUntil`, `event.req.runtime` and `event.req.context` are not available: scriptc can't add properties to a `Request`. Use `event.context` instead of `event.req.context`.
- Route handlers and server assets are imported eagerly (no lazy loading). Node.js format handlers are not supported.
- Returning a `Blob` from a handler fails with a 500 error.
- WebSockets, scheduled tasks, HTTPS, UNIX sockets and graceful shutdown are not supported. The server warns and listens on HTTP over TCP when TLS or a UNIX socket is configured.
- Cached functions without a name are named by the order they are defined, and their integrity does not change with their code. Use the `name` and `integrity` options with persistent cache storage.
- Many npm packages don't compile yet. scriptc reports what fails when it compiles the bundle. Some code compiles but throws when it runs: `scriptc coverage .output/server/index.mjs` lists it.

Some patches also change behavior when the bundle runs with Node.js:

- Cached functions without a name are named `anon_<n>` by the order they are defined, instead of by a hash of their code, so their cache keys change.
- All `SharedArrayBuffer` arguments of cached functions hash the same.
- h3 logs unhandled errors as their stack and `cause`, instead of the inspected error.
- h3's shared default headers of empty and JSON responses are no longer frozen, and `HTTPResponse` objects from another copy of h3 are not recognized.
- `get()`, `post()` and the other method helpers are defined on `H3`, not on `H3Core.prototype`.

:read-more{to="https://scriptc.dev"}
