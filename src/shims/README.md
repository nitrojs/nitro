Bundle-time replacements for the optional dependencies of the libraries Nitro bundles (see the
`resolve.alias` entries in `build.config.ts`).

Nitro does not declare those packages as (peer) dependencies, so a bare `import("<id>")` inside a
bundled library cannot be resolved from Nitro's own `dist/`. Each shim resolves the real package
from the user project instead, installing it on demand.
