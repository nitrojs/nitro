# Rspack Builder — Next Steps

Status snapshot: `NITRO_BUILDER=rspack vitest run test/presets/standard.test.ts` reports **50 passed / 2 skipped (wasm) / 1 todo**. Everything else in the standard suite works end-to-end through rspack.

This plan now focuses on the largest correctness gap remaining: **externals + node_modules tracing**.

## What's complete

| Capability | Implementation |
| --- | --- |
| builder wiring (`"rspack"` everywhere) | `src/build/build.ts`, `src/config/resolvers/builder.ts`, type/dep wiring |
| in-memory virtual modules | `src/build/rspack/plugins/vfs.ts` (`NitroVfsPlugin`) |
| `raw:` scheme (text + binary) via VFS | `src/build/rspack/plugins/raw.ts` (`NitroRawPlugin`) |
| `globalThis.__nitro_main__ = import.meta.url` entry banner | `rspack.BannerPlugin` in `config.ts` |
| `builtin:swc-loader` w/ tsconfig JSX options | `config.ts` |
| sourcemap `sources` use real absolute paths | `output.devtoolModuleFilenameTemplate = "[absolute-resource-path]"` |
| basic externals (resolved → absolute `file://` URL) | inline `createExternals()` in `config.ts` |
| `.wasm` stub (parity-blocking, not deploy-blocking) | VFS-served stub + `NormalModuleReplacementPlugin` |

## Why the current externals impl is not deployable

The inline `createExternals()` in `src/build/rspack/config.ts` does enough to make `standard` tests run on the build machine — but the output is **not portable**.

Concrete failure modes:

1. **Externalized requests become `module-import file:///abs/path/to/build-machine/node_modules/pkg/...`.** Deploying the `.output/server/` directory to another host (or a container with a different `node_modules` layout) breaks every external import — the absolute paths only exist on the machine that ran the build.
2. **No `node_modules` tracing.** rolldown/rollup feed external resolutions into `nf3.traceNodeModules()` after the build, which uses `@vercel/nft` to walk the resolved files' dependency graphs and **copies the minimal set of node_modules into `output.serverDir/node_modules/`**. We skip that entirely, so the output dir doesn't contain the dependencies it imports.
3. **No special-case package handling.** rolldown consults `nf3/db`'s `NodeNativePackages` (e.g. `better-sqlite3`), `NonBundleablePackages`, and `FullTracePackages` lists; we don't, so native modules will not be marked traceable and packages that require full directory copies (sharp, prisma, etc.) lose siblings/binaries.
4. **`nitro.options.traceDeps` is ignored.** Users add packages here when nft can't statically detect them; we have no surface for it.
5. **Import IDs are ugly.** We emit the resolved pnpm-store path verbatim. rolldown normalizes back to `pkgname/subpath` via `toImport()` so the import statement reads like a normal Node import.

Result: builds pass tests on the dev machine, but `npx nitro preview` (or any real deploy) will fail to start once the `.output/` dir is moved.

## Stage C — `NitroExternalsPlugin` + nf3 integration  *(this stage)*

Goal: produce a `.output/server/` directory that contains both `index.mjs` and a self-contained `node_modules/` tree, with bare specifier imports that resolve naturally at runtime.

### Design

New file `src/build/rspack/plugins/externals.ts` with `NitroExternalsPlugin`. Constructor takes the same options shape as the rolldown externals plugin (`src/build/plugins/externals.ts:14-20`):

```ts
{
  rootDir: string;
  conditions: string[];
  exclude: (string | RegExp)[];   // bundle these (noExternal + virtual prefixes)
  include: (string | RegExp)[];   // force-trace these (traceDeps)
  trace: false | { outDir; nft; chmod; writePackageJson; fullTraceInclude; ... };
}
```

Lifecycle inside `apply(compiler)`:

1. **`compiler.hooks.normalModuleFactory` → `factory.hooks.beforeResolve.tapPromise`**
   - Mirror today's externals function, but:
     - Skip when `data.contextInfo?.issuer` is undefined / matches noExternal.
     - Resolve `data.request` to an absolute path with `exsolve.resolveModulePath` (same conditions logic, fall back to `runtimeDir` like today).
     - Cache the (request, importer) → resolved mapping in a `Map<string, string>` to keep `beforeResolve` cheap and avoid re-resolving subpaths.
   - On externalize:
     - **Tracing mode (production):** emit a *bare specifier* `pkgname[/subpath]` derived from the resolved path (see `toImport()` below). Store the absolute path in a `tracedPaths: Set<string>` for stage 2. Rewrite `data.request = "<bare-specifier>"` and rely on `externalsType: "module-import"` + `externalsPresets.node` so rspack emits a real ESM `import`.
     - **Dev / prerender (no tracing):** keep current behavior — `module-import file:///abs/path` — so the prerender + dev runtime can use it without having node_modules in the output yet.

2. **`toImport(resolvedPath)`** — port of rolldown's helper. Walks back from a resolved path to a `pkgname` + optional subpath using `pathToPkgName` (already in `src/build/chunks.ts`) plus a small subpath resolver: read the package's exports/imports map (via `pkg-types`), find the export that produced this path. If multiple candidates, prefer the shortest. Fall back to `guessSubpath(resolvedPath, conditions)` (port from rolldown externals) which tries `index.js`, `dist/index.mjs`, etc., for packages without an exports map.

3. **`NodeNativePackages` / `FullTracePackages` / `NonBundleablePackages`** — import from `nf3/db`. During `beforeResolve`, if the resolved package matches one of these:
   - `NodeNativePackages` or `NonBundleablePackages` → force-externalize even if patterns say bundle.
   - `FullTracePackages` → add to `fullTraceInclude` passed to `traceNodeModules` so the trace copies the whole package dir (binaries, native bindings).

4. **`compiler.hooks.afterEmit.tapPromise`** (or `compilation.hooks.processAssets` at the `PROCESS_ASSETS_STAGE_REPORT` stage if afterEmit fires too early for some hosts) — invoke `traceNodeModules([...tracedPaths], { ...opts.trace, rootDir, conditions, writePackageJson: true })`. Surface `tracedPackages` / `tracedFiles` counts via `nitro.logger.info` exactly like the rolldown plugin (`src/build/plugins/externals.ts:163-188`). Skip entirely when `opts.trace === false`.

5. **Tracing skip rules** — replicate `nitro.options.dev || preset === "nitro-prerender"` from the rolldown builder (`src/build/plugins.ts:55`). The plugin receives a `trace: false` in those cases from `config.ts`; same call site as today.

### Wiring in `config.ts`

Replace today's inline `createExternals()` with the plugin:

```ts
const externalsPlugin = new NitroExternalsPlugin({
  rootDir: nitro.options.rootDir,
  conditions: nitro.options.exportConditions ?? [],
  exclude: base.noExternal,
  include: nitro.options.traceDeps ?? [],
  trace:
    nitro.options.dev || nitro.options.preset === "nitro-prerender"
      ? false
      : {
          ...nitro.options.traceOpts,
          outDir: nitro.options.output.serverDir,
        },
});
```

…and feed it into `plugins:` (drop the `externals` config key, the plugin owns the `beforeResolve` hook). Keep `externalsPresets: { node: true }` and `externalsType: "module-import"` — they handle the actual import emission.

### Verification plan

1. `NITRO_BUILDER=rspack pnpm vitest run test/presets/standard.test.ts` must still report **50 passed**.
2. `ls /tmp/nitro-tests/standard/.output/server/node_modules` must exist and contain the externalized packages.
3. `grep -c "file:///" /tmp/nitro-tests/standard/.output/server/index.mjs` must drop to 0 (no machine-absolute paths in the bundle).
4. Pick the bundled output, copy it to a sibling temp dir without the workspace's node_modules, and verify `node index.mjs` followed by `fetch(...)` still works. (Test script can live under `test/scripts/`.)
5. Run `NITRO_BUILDER=rspack pnpm vitest run test/presets/node.test.ts` once stage C lands — same node preset that production-bundles dependencies.

### Subtasks

- [ ] Port `toImport()` + `guessSubpath()` from `src/build/plugins/externals.ts` into a `_externals-utils.ts` so both rolldown and rspack share them (the rolldown ones currently live inside the plugin file).
- [ ] Implement `NitroExternalsPlugin` (`apply`, `beforeResolve` hook, `tracedPaths` set, `afterEmit` invoking `traceNodeModules`).
- [ ] Wire into `config.ts`, delete the inline `createExternals()` helper.
- [ ] Add a focused test under `test/unit/` for `toImport`/`guessSubpath` if not already covered.
- [ ] Update `PLAN.md` and the rspack docs page once green.

### Risk / open questions

- **`compilation.hooks.processAssets` vs `compiler.hooks.afterEmit`** — `afterEmit` fires after files hit disk, which is what nf3 expects (it copies to `outDir`). But some rspack output sinks may skip `afterEmit` if `output.path` is virtual. Probably fine for nitro (we always write to `output.serverDir`), but worth verifying.
- **Tracing during `prerender`** — the prerender stage builds with `preset === "nitro-prerender"`, trace disabled. But the *outer* production build that runs next sees the same node_modules; make sure the plugin instance isn't shared across `createNitro()` calls (it shouldn't be — `getRspackConfig()` constructs a fresh one).
- **Conditional pnpm/workspace layout** — exsolve resolves into `.pnpm/...`, but nf3 walks from the resolved path and discovers the symlinked package; this works for rolldown today, should also work here.
- **`compatiblePackages` revert in `package.json`** — automd keeps removing the `@rspack/core` entry. Once Stage C is green, re-add and pin the entry to a stable rspack version so automd has a real source-of-truth row.

## Stage D — preset matrix + remaining production gaps

(Touched only briefly here so the focus stays on Stage C.)

- `inlineDynamicImports` parity (workers, prerender) — `optimization.splitChunks: false` + single-entry layout.
- Port `getChunkName` (`src/build/chunks.ts`) into an `output.chunkFilename` function so chunks land in `_libs/`, `_routes/`, `_tasks/`, matching rolldown's output tree.
- Run `test/presets/{node,cloudflare-module,vercel,netlify,aws-lambda}.test.ts` with `NITRO_BUILDER=rspack` and triage.
- Add `"test:rspack": "NITRO_BUILDER=rspack pnpm vitest"` to `package.json` and to the CI matrix.

## Stage E — dev server

Stub today; productionize:

- chokidar watchers on `apiDir` / `routesDir` / `middleware` / `plugins` / `modules`.
- Rerun `scanHandlers`, re-render virtual modules, invalidate watcher on add/unlink (mirror `src/build/rolldown/dev.ts`).
- Hook `rollup:reload` → `vfs.preload()` + `watcher.invalidate()`.
- Validate via `test/presets/nitro-dev.test.ts`.

## Out of scope

Keep deferred until Stage C/D/E are settled:

- **wasm** — currently skipped in tests for rspack; needs an unwasm-equivalent plugin emitting `{ default: init, ...named }`.
- **`unimport` auto-imports** — `unimport/unplugin` should drop in next to the SWC rule; deferred until any fixture exercises it under rspack.
- **Route meta / OpenAPI** — rolldown uses a `transform` hook; port via a small loader.
- **Docs** — user-facing `docs/...` page for the builder + `rspackConfig` override.
