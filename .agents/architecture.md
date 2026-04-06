# Nitro Architecture Deep Dive

## Core Instance (`src/nitro.ts`)

`createNitro(config, opts)` creates the main context with:
- `options: NitroOptions` — Resolved configuration
- `hooks: Hookable<NitroHooks>` — Build lifecycle hooks
- `vfs: Map<string, { render }>` — Virtual file system
- `routing: { routes, routeRules, globalMiddleware, routedMiddleware }`
- `scannedHandlers: NitroEventHandler[]`
- `unimport?: Unimport` — Auto-imports (optional)
- `logger: ConsolaInstance`
- `updateConfig(config)` — Hot-reload config
- `close()` — Cleanup

**Setup flow:**
1. Load options via `loadOptions()`
2. Install modules via `installModules()`
3. Init routing via `initNitroRouting()`
4. Scan handlers/plugins/tasks via `scanAndSyncOptions()`
5. Prepare unimport for auto-imports
6. Setup hooks

## Entry Points

- `src/builder.ts` — Main public API: `createNitro()`, `build()`, `createDevServer()`, `prerender()`, `copyPublicAssets()`, `prepare()`, `writeTypes()`, `runTask()`, `listTasks()`
- `src/vite.ts` — Vite plugin export from `src/build/vite/plugin.ts`

## Build System (`src/build/`)

**Builder dispatch** (`build/build.ts`): delegates to `rollup`, `rolldown`, or `vite` based on `nitro.options.builder`.

**Builder selection** (resolved in `config/resolvers/builder.ts`):
- Check `NITRO_BUILDER` / `NITRO_VITE_BUILDER` env vars
- Auto-detect available packages
- Fallback: rolldown → vite → rollup

**Base config** (`build/config.ts`):
- Extensions: `.ts`, `.mjs`, `.js`, `.json`, `.node`, `.tsx`, `.jsx`
- Import.meta replacements (`import.meta.dev`, `import.meta.preset`, etc.)
- Unenv aliases for polyfills
- External dependency patterns

**Plugins** (`build/plugins.ts`):
1. Virtual modules — renders from `build/virtual/`
2. Auto imports — Unimport plugin
3. WASM loader — unwasm
4. Server main injection — `globalThis.__server_main__`
5. Raw imports — `?raw` suffix
6. Route meta — OpenAPI metadata
7. Replace plugin — variable substitution
8. Externals plugin — Node.js native resolution
9. Sourcemap minify (optional)

**Virtual modules** (`build/virtual/`, 14 templates):
All prefixed `#nitro/virtual/<name>`:
- `routing.ts` — Compiled router matcher
- `plugins.ts` — Plugin registry
- `error-handler.ts` — Error handler
- `public-assets.ts` — Public asset metadata
- `server-assets.ts` — Server asset metadata
- `runtime-config.ts` — Runtime config object
- `database.ts` — Database setup
- `storage.ts` — Storage backends
- `tasks.ts` — Task registry
- `polyfills.ts` — Env polyfills
- `feature-flags.ts` — Feature detection
- `routing-meta.ts` — Route metadata (OpenAPI)
- `renderer-template.ts` — SSR renderer
- `_all.ts` — Aggregator

## Configuration System (`src/config/`)

**Loader** (`config/loader.ts`): `loadOptions(config, opts)`
1. Merge with defaults (`NitroDefaults`)
2. Load c12 config files (`nitro.config.ts`, `package.json.nitro`, etc.)
3. Resolve preset
4. Run config resolvers sequentially

**Resolvers** (`config/resolvers/`):
`compatibility`, `tsconfig`, `paths`, `imports`, `route-rules`, `database`, `export-conditions`, `runtime-config`, `open-api`, `url`, `assets`, `storage`, `error`, `unenv`, `builder`

**Defaults** (`config/defaults.ts`): All NitroConfig defaults.

## Runtime (`src/runtime/`)

**Internal** (`runtime/internal/`):
- `app.ts` — NitroApp creation, H3 app setup
- `cache.ts` — Response caching
- `context.ts` — Async context
- `route-rules.ts` — Route rule middleware (headers, redirect, proxy, cache, cors)
- `static.ts` — Static file serving
- `task.ts` — Task execution
- `plugin.ts` — Plugin helpers
- `runtime-config.ts` — Config getter

**Public exports**: `runtime/app.ts` (`defineConfig()`), `runtime/nitro.ts` (`serverFetch()`), `runtime/cache.ts`, `runtime/task.ts`, `runtime/storage.ts`, etc.

## Dev Server (`src/dev/`)

- `dev/server.ts` — `NitroDevServer`: Worker management via `env-runner`, restart on failure (max 3 retries), WebSocket support, VFS debug endpoint (`/_vfs/**`)
- `dev/app.ts` — `NitroDevApp`: H3 app with error handling, static serving with compression, dev proxy

## Prerender (`src/prerender/`)

- `prerender/prerender.ts` — Main flow: parse routes → build prerenderer (preset: `nitro-prerender`) → execute in parallel → link crawling → write to disk → compress
- `prerender/utils.ts` — `extractLinks()`, `matchesIgnorePattern()`, `formatPrerenderRoute()`

## Routing & Scanning (`src/routing.ts`, `src/scan.ts`)

**Scanning**: Discovers routes, middleware, plugins, tasks, modules from filesystem.

Route file conventions:
- `routes/index.ts` → `GET /`
- `routes/users/[id].ts` → `GET /users/:id`
- `routes/users/[...slug].ts` → `GET /users/**:slug`
- `api/users.post.ts` → `POST /api/users`
- `.dev`/`.prod`/`.prerender` suffixes for environment filtering

**Router** (`Router` class): Based on `rou3`, compiles to optimized string matcher, supports method routing + env conditions.

## Presets (`src/presets/`)

31 presets. Structure per preset:
```
presets/<name>/
├── preset.ts        # defineNitroPreset()
├── runtime/         # Runtime entry (bundled)
├── types.ts         # Types (optional)
├── utils.ts         # Build-time utils (optional)
└── unenv/           # Env overrides (optional)
```

Key presets: `standard`, `node` (server/middleware/cluster), `cloudflare` (pages/workers), `vercel`, `netlify`, `aws-lambda`, `deno`, `firebase`, `azure`, `bun`, `winterjs`

Resolution: `presets/_resolve.ts` handles aliases, dev/prod, compat dates, static hosting.

## CLI (`src/cli/`)

Uses `citty` with lazy-loaded commands: `dev`, `build`, `deploy`, `preview`, `prepare`, `task`, `docs`.

## Key Libraries

| Library | Purpose |
|---------|---------|
| `h3` | HTTP framework |
| `rou3` | Route matching |
| `c12` | Config loading |
| `citty` | CLI framework |
| `hookable` | Hook system |
| `unimport` | Auto-imports |
| `unstorage` | Storage abstraction |
| `unenv` | Runtime polyfills |
| `defu` | Config merging |
| `pathe` | Path operations |
| `consola` | Logging |
| `env-runner` | Worker management |
