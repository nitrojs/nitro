# Vite Dev Middleware — Request Routing

> Scope: the request-routing logic in `src/build/vite/dev.ts` — the two
> `server.middlewares.use(...)` registrations (`nitroDevMiddlewarePre` and the
> catch-all `nitroDevMiddleware`): why the current design looks the way it does.

## 1. Where it lives & how it is wired

- Logic: `src/build/vite/dev.ts` → `configureViteDevServer(ctx, server)`.
- Entry: `src/build/vite/plugin.ts:266` — the plugin's `configureServer` hook
  `return`s the result of `configureViteDevServer`.

Vite's `configureServer` contract: middleware registered **synchronously**
inside the hook runs **before** Vite's internal middlewares; a function
**returned** from the hook runs **after** them (the "post" hook). Nitro uses
both ends:

| Registration | Site | Runs | Role |
|---|---|---|---|
| `nitroDevMiddlewarePre` (`const` form) | `dev.ts:284` | **before** Vite static/transform | Classifier. Route explicit-Nitro + definite navigations to Nitro immediately; let definite assets fall through to Vite, marking them `_nitroHandled` (transparent catch-all) or `_nitroAssetCheck` (opaque catch-all / no match). |
| `nitroDevMiddleware` | `dev.ts:371`, inside the returned `() => { ... }` | **after** Vite static/transform | Catch-all fallback. Wraps req as web `Request`, tries `ctx.devApp.fetch` then `nitroEnv.dispatchFetch`, honoring `baseURL`; inspects the response for `_nitroAssetCheck` requests. Skipped for `_nitroHandled`. |

**Why two, and why pre?** Without the pre-pass, Vite's static/transform
middleware serves files from the project root and would answer server routes
before Nitro sees them (see upstream **vitejs/vite#20866**, which made Vite
consult `sec-fetch-dest` to let document requests fall through — the same
header Nitro's classifier leans on).

Facts about Vite's side (verified against vite@8.1.4): Nitro forces
`appType: "custom"` (`plugin.ts:199`), so Vite registers none of
`htmlFallback`/`indexHtml`/`notFound` middlewares, and **every plain miss
`next()`s** (sirv and transformMiddleware never self-emit a 404 for a missing
file/module). The only terminal 404 is connect's `finalhandler`, which sits
**after** the Nitro post-hook. So Vite genuinely hands off every request it
cannot serve — the post catch-all is the last handler before `finalhandler`.

## 2. Classification

`nitro.routing.routes` in an SSR app **always** contains a catch-all `/**`, so
"does a Nitro route match?" is nearly always *yes*. The design distinguishes:

- **Explicit route** — `route` set, `!== "/**"`, not `startsWith("/**:")` (a
  prefixed splat like `/api/photos/**` is explicit). Deterministic → **always
  Nitro**, no heuristic may override (#4108, #4241, #4252, #4270).
- **Explicit public asset** — a public-asset dir under a non-root `baseURL`
  with `fallthrough: false` owns its subtree → Nitro, like an explicit route.
- **Transparent catch-all** — a *user route file* at root level
  (`routes/[...].ts` → `/**`, `routes/[...slug].ts` → `/**:slug`). Nitro sees
  everything it can handle, so Vite stays the definitive asset handler: an
  asset-tagged request is marked `_nitroHandled` and a Vite miss must **not**
  fall back into it (#4234/#4266).
- **Opaque catch-all** — the SSR renderer `/**` or a custom `serverEntry` `/**`
  (both registered in `routing.ts` with identifiable `handler` paths). Their
  *real* routes are invisible to the host (`server.ts` H3 app routes, framework
  routers like TanStack Start), so an asset-tagged miss from Vite must still be
  **dispatched** — marked `_nitroAssetCheck`, decided by response inspection.
- **None** — no match. Extensionless → page navigation → Nitro; asset-tagged →
  same as opaque (`_nitroAssetCheck`, dispatch after Vite).

## 3. The asset heuristic (catch-all / none case only)

Set `Vary: sec-fetch-dest, accept`, then:

- **`Sec-Fetch-Dest` present & concrete** (not `empty`): `document`/`iframe`/
  `frame` = navigation → Nitro; anything else (`image`, `video`, `style`, …) =
  asset.
- **Absent or `empty`**: fall back to extension — `ASSET_EXT_RE.test(ext)`
  **and** no `text/html` in `Accept` ⇒ asset. (`empty` = fetch/XHR is ambiguous:
  it tags both API calls and `fetch()`ed assets.)
- **Only `GET`/`HEAD` can be assets at all** — a `POST /upload.png` is never a
  browser asset load, so other methods bypass the heuristic entirely.
- Non-asset + (matched or extensionless) → Nitro immediately (pre-Vite).

Two regexes to keep intact:
- `ASSET_EXT_RE` (`dev.ts:24`) — narrow on purpose, so dotted Nitro params like
  `/foo.bar.1` still reach Nitro (#4108).
- Extension is extracted from the path only (query/hash stripped) so
  `?file=bar.png` does not misclassify.

## 4. Response inspection (`_nitroAssetCheck`)

An asset-tagged request that only an opaque catch-all could handle cannot be
classified **a priori** — `/image.png` may be a real custom-entry route (#4252)
or a genuinely missing asset that a naive SSR `/**` would render as a 200 page
(#4234). It *can* be classified from the **response**: after Vite declines and
the post catch-all dispatches to Nitro, a 2xx with a `text/html` content-type
(inline check in the post middleware) means the catch-all rendered a page for a
missing asset → the response is discarded via `next()` (connect `finalhandler`
404, same as before). Anything else — real asset types, JSON, `text/plain`, no
content-type, non-2xx (framework 404 pages, redirects) — passes through
verbatim.

Deny-list rationale (all verified empirically):

- Only `text/html` counts as a swallow. `application/json` was originally
  denied too, but that broke real opaque frameworks: TanStack Start answers
  API routes tagged as asset loads with JSON on purpose
  (`<img src="/api/.../thumbnail">`, TanStack/router#7403, nitro PR #4274),
  and sourcemaps (`.map` ∈ `ASSET_EXT_RE`) are legitimately JSON. The
  accepted trade-off: an SSR entry that swallows missing assets with *JSON*
  (pathological — real naive SSR renders HTML) now returns 200 JSON instead
  of 404 in dev.
- `text/plain` is excluded because a bare string returned from an h3 handler
  has **no** content-type at the h3 layer but arrives as `text/plain;
  charset=UTF-8` — srvx's node-adapter default applied on the worker's HTTP hop
  (`srvx/dist/adapters/node.mjs`; runner-dependent but converges) — and must
  pass through (custom-entry handlers returning strings).
- Transparent (user-file) catch-alls can **not** use inspection instead of the
  divert: their string 200s arrive with no distinguishing content-type.

This keeps everything zero-config, host-side only (no runtime/bundle change,
no production behavior change). Known leftovers:

- **Production** SSR still renders 200 HTML for missing-asset URLs —
  pre-existing behavior; changing it is a separate, deliberate breaking-change
  discussion.
- Opaque semantics require registration via `renderer` / `serverEntry`. A `/**`
  catch-all added through `routes:` / `handlers:` config or a module is
  classified **transparent** and stays pre-empted for asset-tagged requests
  (#4252-class limitation) — a framework integrating its renderer that way
  should use `renderer` instead.
- Dev-only cost: a missing asset matching an opaque catch-all triggers a full
  (discarded) SSR render before the 404.

## 5. Issue / PR lineage (chronological)

- **#3649** first crude "has extension ⇒ Vite" rule; **#3804/#3805/#3817**
  middleware improvements, mounted-path skip, internal-prefix skip (survives as
  the `^\/(?:__|@)` guard); **#4098** `sec-websocket-protocol` to tell Vite HMR
  sockets from Nitro websockets (the `upgrade` handler).
- **#4108** baseURL-aware matching for dotted Nitro routes
  (TanStack/router#6903).
- **#4234** non-loopback plain-HTTP origins omit `Sec-Fetch-*` → splat swallowed
  `<script src>` loads. Fixed by **#4238**: `Accept` + `ASSET_EXT_RE` fallback +
  the `_nitroHandled` marker.
- **#4241** #4238 over-eager: `sec-fetch-dest: image` on a real route
  (`/api/image`) sent to Vite → 404. Fixed by `7d49dcae` + `08f2ec69`
  (query-string stripped before extension matching).
- **#4252 / #4270** even explicit routes lost when the URL had an asset
  extension. Fixed by **#4272** (`5b7e152b`): explicit vs catch-all vs none
  classification — **an explicit route is a deterministic win no heuristic can
  touch**.
- `7765bcb7` added `isExplicitPublicAsset`.
- **#4252 follow-ups** (katywings, jantimon/TanStack/router#7403): routes the
  classifier cannot see — a custom `server.ts` H3 app serving `/image.png`, or
  an SSR framework serving assets — were pre-empted by `_nitroHandled` and
  could never run. Fixed by the opaque-catch-all + response-inspection design
  above (§2, §4): the pre-emption now applies only to transparent user-file
  catch-alls, and opaque dispatches are judged by their response content-type.

## 6. Runtime dispatch flow

The catch-all `nitroDevMiddleware` dispatches in two stages:

1. **`ctx.devApp.fetch(req)`** — `NitroDevApp` (`src/dev/app.ts`), host-side:
   `devHandlers`, `/_vfs/**`, `/_nitro/tasks`, public asset dirs, `devProxy`.
   No catch-all → a 404 means "not mine, hand off"; any non-404 is returned
   directly (never inspected — deterministic host serves are authoritative).
2. **`nitroEnv.dispatchFetch(req)`** → env-runner → worker → `nitroApp.fetch` →
   full route table, middleware, catch-alls.

Catch-all registration (`src/routing.ts`): a custom `serverEntry` is pushed as
`/**` with `handler = nitro.options.serverEntry.handler`; the SSR renderer as
`/**` with `handler = nitro.options.renderer.handler` (set by `plugin.ts`
`configResolved` to `internal/vite/ssr-renderer` when an `ssr` service exists).
These handler paths are how the pre-pass identifies opaque catch-alls.

## 7. Test coverage map

All under `test/vite/`; run via `test:rollup` and `test:rolldown`. Each starts
a real Vite dev server and `fetch()`es with hand-set headers.

- `app.test.ts` (`app-fixture/`) — SSR `/**` path. #4234 swallow contracts
  (missing `.css`/`.js` under `style`/absent/`empty` dests must not 200 — the
  fixture entry renders an HTML page for extensioned misses), JSON API routes
  under `sec-fetch-dest: image` pass through (TanStack/router#7403), #4252
  deliberate asset serve (`/dynamic-asset.png` → `image/png` passes
  inspection), `HTTPError` propagation, navigations, storage/config sharing.
- `server-entry.test.ts` (`server-entry-fixture/`) — #4252 custom `server.ts`
  H3 app: asset-extensioned routes reachable under `image`/absent/`script`
  dests (including a no-content-type string return), JSON sourcemap
  (`/generated.js.map`) passes through, `POST` to an asset-extensioned route
  reaches its handler (non-GET/HEAD are never assets), missing-asset 404
  contract, navigation.
- `root-wildcard.test.ts` — transparent root catch-all `/**:path`: must never
  200 for `/entry-client.ts` under `script`/`style`/`image`/absent dests
  (#4234/#4266), navigations still reach it.
- `baseurl-dotted-param.test.ts` — explicit splat routes under `baseURL:
  /subdir/`: #4241, #4252, #4270, query-string extension, unmatched asset →
  Vite.
- Tangential: `hmr.test.ts` (existing module served by Vite under `script`
  dest), `openapi.test.ts` (explicit routes), others (build/env, not routing).

## 8. Gotchas

- The `server.middlewares.stack` scan in `nitroDevMiddleware` skips requests
  whose URL starts with any other middleware's mounted `base` (#3805).
- `_nitroHandled` is a one-way latch set by the pre-pass (transparent
  catch-all asset) and by the post catch-all itself (re-entry guard). Never set
  it for a request a real or opaque handler should still see (#4252 root
  cause).
- Extension detection must stay path-only (strip `?#`) and `ASSET_EXT_RE` must
  stay narrow, or dotted Nitro params regress (#4108).
- The inspection's html-only check must not grow `text/plain` (bridge default
  for string returns) or `application/json` (deliberate API serves, #7403), and it must only apply to `envRes.ok` — framework 404 pages
  and redirects pass through verbatim.
- The websocket `upgrade` handler is a separate concern sharing the "Vite's or
  Nitro's?" theme.
