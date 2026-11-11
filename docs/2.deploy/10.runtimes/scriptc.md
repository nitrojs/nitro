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

If `scriptc` is not found, the build only warns and prints the command to compile `.output/server/index.mjs` manually. The bundle also runs with Node.js (`node .output/server/index.mjs`).

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

The preset includes an HTTP/1.1 server for scriptc's `node:http`, and patches Nitro, h3 and other bundled libraries at build time where scriptc can't compile them yet. The patches keep the same behavior on Node.js. Some features still don't work:

- `event.req.ip`, `event.req.waitUntil`, `event.req.runtime` and `event.req.context` are not available: scriptc can't add properties to a `Request`. Use `event.context` instead of `event.req.context`.
- Route handlers are imported eagerly (no lazy loading).
- WebSockets, scheduled tasks, HTTPS, UNIX sockets and graceful shutdown are not supported.
- Cached functions without a name are named by the order they are defined, and their integrity does not change with their code. Use the `name` and `integrity` options with persistent cache storage.
- Many npm packages don't compile yet. scriptc reports what fails when it compiles the bundle.

:read-more{to="https://scriptc.dev"}
