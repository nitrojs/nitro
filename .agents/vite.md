# Nitro Vite Build System

## Overview

`src/build/vite/` is Nitro's Vite-based build system using Vite 6+ multi-environment API. It integrates as a Vite plugin (`nitro()`) that manages server builds, service environments, dev server, and production output.

## File Map

| File | Purpose |
|------|---------|
| `plugin.ts` | Main plugin — 6 sub-plugins orchestrating the build |
| `env.ts` | Vite environment creation (nitro, services, env-runner) |
| `dev.ts` | Dev server integration, `FetchableDevEnvironment`, middleware |
| `prod.ts` | Production multi-env build, asset management, virtual setup module |
| `bundler.ts` | Rollup/Rolldown config generation |
| `build.ts` | CLI build entry for `nitro build` (`viteBuild()`) |
| `preview.ts` | Preview server plugin |
| `types.ts` | Type definitions (`NitroPluginConfig`, `NitroPluginContext`) |

## Plugin Architecture (`plugin.ts`)

`nitro(config?)` returns an array of 6 sub-plugins:

### 1. `nitroInit` — Context Setup
- Calls `setupNitroContext()` on first `config` hook
- Creates Nitro instance via `createNitro()`
- Detects Rolldown vs Rollup (`_isRolldown`)
- Resolves bundler config via `getBundlerConfig()`
- Initializes env-runner in dev mode
- Attaches rollup plugins for dev environments

### 2. `nitroEnv` — Environment Registration
- Registers Vite environments: `client`, `nitro`, and user services
- Auto-detects `entry-server` for SSR
- Configures per-environment build options (consumer type, externals, etc.)

### 3. `nitroMain` — Build Orchestration
- Sets app type to `"custom"`
- Configures resolve aliases, server port
- `buildApp` hook → calls `buildEnvironments()` (production)
- `generateBundle` hook → tracks entry points
- `configureServer` → calls `configureViteDevServer()` (dev)
- `hotUpdate` → server-only module reload

### 4. `nitroPrepare` — Output Cleanup
- Cleans build directory before build starts

### 5. `nitroService` — Virtual Module Handler
- Resolves `#nitro-vite-setup` virtual module
- Provides production setup code for service environments

### 6. `nitroPreviewPlugin` — Preview Server
- Routes all preview requests through Nitro
- WebSocket upgrade support

## `setupNitroContext()` Flow

1. Merge plugin config with user config
2. Load dotenv files
3. Detect SSR entry (looks for `entry-server.{ts,js,tsx,jsx,mjs}`)
4. Create Nitro instance (`createNitro()`)
5. Resolve bundler config (`getBundlerConfig()`)
6. Initialize env-runner for dev (`initEnvRunner()`)

## Environments (`env.ts`)

Nitro uses Vite 6+ environments API for multi-bundle builds:

| Environment | Consumer | Purpose |
|-------------|----------|---------|
| `client` | `"client"` | Browser HTML/CSS/JS |
| `nitro` | `"server"` | Main server bundle |
| `ssr` | `"server"` | Optional SSR service |
| Custom | `"server"` | User-defined services |

### `createNitroEnvironment()`
- Consumer: `"server"`
- Uses bundler config (Rollup/Rolldown)
- Dev: creates `FetchableDevEnvironment` with hot reload
- Prod: standard environment with minify, sourcemap, commonJS options
- Resolve: `noExternal` differs for dev vs prod
- Special conditions: `"workerd"` for miniflare, excludes `"node"`

### `initEnvRunner()` / `getEnvRunner()`
- Uses `env-runner` package for worker management
- Supports Node Worker or Miniflare runtime
- Auto-restarts on failure (max 3 retries)
- Custom evaluator for workerd (`AsyncFunction` not allowed)
- Routes module imports through Vite's transform pipeline

### `reloadEnvRunner()`
- Triggers full reload of the env-runner worker

## Dev Server (`dev.ts`)

### `FetchableDevEnvironment` (extends `DevEnvironment`)
- Overrides `fetchModule()` for CJS/ESM resolution
- For workerd: prevents externalization of bare imports
- `dispatchFetch()` — routes requests to the dev server worker
- Sends custom message on init with environment info

### `configureViteDevServer()`
- Watches Nitro config file for changes (triggers full restart)
- WebSocket upgrade handling
- File watchers for route/API/middleware directories (debounced reload)
- RPC for `transformHTML` messages

### Dev Middleware (`nitroDevMiddleware`)
Two-stage request routing:

1. **Pre-processor** — checks if request should go to Nitro:
   - Skips Vite internal requests (`/@`, `/__`)
   - Skips file extension requests (`.js`, `.css`, etc.)
   - Uses `sec-fetch-dest` header for browser detection
   - Routes to `NitroDevApp` first (static/proxy/dev handlers)
2. **Main handler** — falls back to env-runner worker for server routes

### Request Flow (Dev)
```
Browser → Vite Dev Server
  → nitroDevMiddleware (pre-processor)
    → NitroDevApp (static assets, dev proxy, /_vfs)
    → env-runner worker (main server logic)
  → Vite static/HMR (if not handled)
```

## Production Build (`prod.ts`)

### `buildEnvironments()` — 5 Stages

**Stage 1: Build non-Nitro environments**
- Client environment (browser bundle)
- Service environments (SSR, API, custom)
- Detailed logging per environment

**Stage 2: Renderer template processing**
- If client input == renderer template, replaces SSR outlet
- Inlines `globalThis.__nitro_vite_envs__?.["ssr"]?.fetch($REQUEST)`
- Moves processed template to build dir

**Stage 3: Asset management**
- Calls `builder.writeAssetsManifest?.()`
- Registers asset dirs with `max-age=31536000, immutable`

**Stage 4: Build Nitro environment**
- `prepare()` → clean output
- Build main server bundle
- Close Nitro instance
- Fire `compiled` hook
- Write build info

**Stage 5: Preview**
- Start preview server, log success

### `prodSetup()` Virtual Module
Generates `#nitro-vite-setup` content:
```js
// For each service environment
globalThis.__nitro_vite_envs__ = {
  "ssr": { fetch: (...args) => import("entry").then(m => m.default.fetch(...args)) }
}
```

## Bundler Config (`bundler.ts`)

`getBundlerConfig()` returns:
```ts
{
  base: BaseBuildConfig,
  rollupConfig?: RollupConfig,   // if using Rollup
  rolldownConfig?: RolldownConfig // if using Rolldown
}
```

Common config: ESM output, tree-shaking, chunking, sourcemaps.

**Rolldown-specific**: Transform injection, library chunking, `inlineDynamicImports`/`iife` support.
**Rollup-specific**: `@rollup/plugin-inject`, `@rollup/plugin-alias`, manual chunk naming.

## HMR (Dev Only)

**Server-only module reload**:
1. `hotUpdate` hook detects file change
2. Determines if module is server-only or shared
3. Server-only → sends `full-reload` to nitro environment
4. Shared → returns for normal Vite client HMR
5. Optionally reloads browser (`experimental.vite.serverReload`)

**Directory watchers** (debounced):
- Routes, API, middleware, plugins, modules dirs
- Add/delete → full routing rebuild + reload

## Runtime Integration

### Worker Entry (`src/runtime/internal/vite/`)

| File | Purpose |
|------|---------|
| `dev-entry.mjs` | Dev entry: polyfills, WebSocket adapter, schedule runner |
| `dev-worker.mjs` | Worker process: `ViteEnvRunner` class, RPC layer, env management |
| `ssr-renderer.mjs` | SSR service: calls `fetchViteEnv("ssr", req)` |

### `ViteEnvRunner` (in `dev-worker.mjs`)
- Manages Vite `ModuleRunner` per environment
- Loads environment entry via `runner.import()`
- Routes fetch requests to loaded entries
- Exposes `__VITE_ENVIRONMENT_RUNNER_IMPORT__` for RSC

### Runtime API (`src/runtime/vite.ts`)
- `fetchViteEnv(name, input, init)` — route fetch to named Vite environment
- Accesses `globalThis.__nitro_vite_envs__` registry

## Dev vs Production

| Aspect | Dev | Production |
|--------|-----|-----------|
| Runner | env-runner (node-worker / miniflare) | Bundled ESM |
| HMR | Full reload on file change | N/A |
| Errors | Interactive error page (Youch) | JSON or minimal HTML |
| Services | Lazy-loaded via env-runner | Pre-bundled via `prodSetup()` |
| Template | Dynamic (vite-env route) | Static (inlined SSR outlet) |
| Sourcemaps | Enabled | Optional |

## Experimental Features

`experimental.vite` options:
- `assetsImport` (default: true) — `?assets` imports via `@hiogawa/vite-plugin-fullstack`
- `serverReload` (default: true) — reload on server-only module changes
- `services` — register custom service environments

## Key Connections

- `src/vite.ts` — public export (`nitro` plugin)
- `src/build/build.ts` — dispatcher calls `viteBuild()`
- `src/build/config.ts` — base build config
- `src/build/plugins.ts` — base build plugins (virtual modules, auto-imports, etc.)
- `src/build/virtual/` — 14 virtual module templates
- `src/dev/app.ts` — `NitroDevApp` for dev-only handlers
- `src/dev/server.ts` — `NitroDevServer` with `RunnerManager`
- `src/runtime/internal/vite/` — runtime worker and entry points
