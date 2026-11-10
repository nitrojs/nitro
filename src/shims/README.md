Bundle-time replacements for the optional dependencies of the libraries Nitro bundles (see the
`resolve.alias` entries in `build.config.ts`).

Nitro does not declare those packages as (peer) dependencies, so a bare `import("<id>")` inside a
bundled library cannot be resolved from Nitro's own `dist/`. Each shim resolves the real package
from the user project instead, installing it on demand.

Each shim is aliased by its file name (`<id>.ts`). Its supported `version` range is listed under
`shims` in `deps.json` (synced by `pnpm sync-deps`) and must stay within the range the bundled
`library` accepts (checked by `test/unit/deps.test.ts`). These packages are not on demand
dependencies of Nitro itself (the `deps` of the manifest).
