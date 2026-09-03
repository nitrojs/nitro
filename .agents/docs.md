# Documentation Guide

## The docs system

`docs/` is a standalone [UnDocs](https://undocs.unjs.io) site (its own `package.json` / lockfile).
`pnpm dev` / `pnpm build` inside `docs/`. UnDocs is a plain Vue + Vite + Nitro app — **not Nuxt**.

```
docs/
  .config/docs.yaml   # site config (name, github, socials, themeColor, redirects, versions)
  .docs/              # custom theme layer (optional)
    components/       # .vue — usable from markdown + globally registered
    pages/            # file routes, layered OVER the built-ins
    layouts/          # named layouts, picked via definePageMeta({ layout })
    utils/            # plain modules, imported by relative path
    public/           # static files served at the site root
    assets/           # files referenced from component <style> blocks
  1.docs/ 2.deploy/ 3.config/ 4.examples/ 9.blog/   # content
  index.md            # landing content
```

Numeric prefixes control nav order; same-prefix files sort alphabetically.

### Theme layer rules

- **No auto-imports.** Every `.docs/**` file imports Vue, undocs composables and components explicitly
  from `undocs/src/app/*` (e.g. `undocs/src/app/components/ui/Button.vue`,
  `undocs/src/app/composables/useContent`, `undocs/src/app/router`). See
  [the custom-theme guide](https://undocs.unjs.io/guide/custom-theme) for the full component list.
- A component file's **basename** is its name: `FeatureCard.vue` → `<FeatureCard>` and `::feature-card`.
  Built-in tags win on a clash. A `.client`/`.server` suffix is stripped and does nothing.
- **Styling uses shadcn semantic tokens** — `text-foreground`, `text-muted-foreground`, `text-primary`,
  `bg-background`, `bg-card`, `bg-muted`, `border-border`, `ring-ring`. Nuxt UI names
  (`border-default`, `bg-elevated`, `text-dimmed`, …) generate no CSS. `dark:` variants are **not**
  wired to undocs' `.dark` toggle (they follow the OS) — use tokens, or a raw `.dark ...` CSS rule.
- **Tailwind only scans `.docs/**` and undocs' own sources, never docs markdown.** Utility classes
  written in markdown frontmatter produce no CSS — keep class names in `.docs/` (e.g.
  `.docs/utils/accents.ts`) and pass a plain name from markdown. The same tree-shaking drops the
  `--color-<themeColor>-*` variables that undocs' runtime `--primary` points at, which silently kills
  every `*-primary` utility — `themePaletteKeepAlive` in `accents.ts` pins them; keep it in sync with
  `themeColor`.
- Content is read over `/api/docs/*` via `queryPage(path)`, `queryNavigation()`, `queryBlog()` (wrap in
  `useAsyncData`), or by injecting the shared `navigation` tree. There is no `queryCollection`.
- The nav tree only carries a page's `navigation:` frontmatter object — other frontmatter keys
  (e.g. `category`) must live under `navigation:` to be visible to sidebars/listings.
- Blocks that fetch during setup (`PageSponsors`, `PageContributors`) need a local `<Suspense>` wrapper
  component before they can be used from markdown.

## MDC syntax

Block components use `::`, nesting adds a colon; inline components use a single `:`.

```markdown
::block{inlineProp="value"}
Default slot content

#namedSlot
Slot content
::

:inline-block{to="/docs"}

Hello [World]{.text-primary}
```

Multiple props go in a YAML block instead:

```markdown
::block
---
title: My Title
items:
  - one
  - two
---
::
```

### Built-in blocks

| Tag | Notes |
| --- | --- |
| `::note` `::tip` `::important` `::warning` `::caution` | callouts |
| `::code-group` | tabs of `:::prose-pre` / fenced blocks |
| `::code-tree{defaultValue expandAll}` | file tree + code preview |
| `::tabs` / `:::tab{label icon}` | tabbed content |
| `::steps` | numbered steps (or a numbered list) |
| `::card{title icon to}` / `::card-group` | content cards |
| `::page-hero{orientation}` | landing hero — `#top` `#headline` `#title` `#description` `#links` slots |
| `::page-section{title description aura}` | landing section |
| `::page-feature{title description icon}` / `::page-card{title description icon to}` | landing blocks |
| `:read-more{to title}` | inline "read more" link |
| `:pm-install` `:pm-run` `:pm-x` | package-manager command blocks |
| `::mermaid` | diagram |

Nitro's own landing blocks live in `docs/.docs/components/` (`::app-hero-links`, `::hero-features`,
`::performance-showcase`, `::landing-features`, `::feature-card`, `::sponsors`, `:hero-background`).

## Content conventions

### Preset names

Canonical preset names use **underscores** (`node_server`, `cloudflare_module`, `digital_ocean`). Both
forms resolve at runtime, but docs use the underscore form.

### Import paths

Nitro v3 uses subpath exports — not deep runtime imports:

```ts
import { defineConfig } from "nitro"; // nitro config (nitro.config.ts)
import { defineHandler } from "nitro"; // event handlers
import { definePlugin } from "nitro"; // runtime plugin
import { defineRouteMeta } from "nitro"; // route meta macro
import { readBody, getQuery } from "nitro/h3"; // other h3 utilities
import { defineCachedHandler, defineCachedFunction } from "nitro/cache";
import { useStorage } from "nitro/storage";
import { useDatabase } from "nitro/database";
import { useRuntimeConfig } from "nitro/runtime-config";
import { defineTask, runTask } from "nitro/task";
```

### H3 v2 API

- **Handler**: `defineHandler()` (not `eventHandler` / `defineEventHandler`)
- **Error**: `throw new HTTPError(message, { status })` (not `createError()`)
- **Router**: `new H3()` (not `createApp()` / `createRouter()`)
- **Response**: return values directly; no `send()`
- **Headers**: `event.res.headers.set(name, value)`
- **Hooks**: the `request` hook receives `(event: HTTPEvent)`, not `(req)`

### Code examples

- Auto imports are not available — always show explicit imports
- Always use `defineHandler` from `"nitro"` (not `eventHandler`)
- Always use `defineConfig` from `"nitro"` for nitro config (not `defineNuxtConfig` or Vite's `defineConfig`)
- Use `"nitro/*"` imports, never `"nitropack/*"`
- Node.js >= 20 in all deployment examples
- Preset env var is `NITRO_PRESET`; runtime config overrides use the `NITRO_` prefix
  (camelCase in config, UPPER_SNAKE_CASE in env)

### Common mistakes

- `send(event, value)`, `createError()`, `eventHandler()` — all removed in h3 v2
- Importing `defineConfig`/`defineHandler` from subpaths — both come from the main `"nitro"` entry
- Duplicate imports (e.g. `defineHandler` from both `nitro/h3` and `nitro/cache`)
- Hyphenated preset names, outdated Node.js versions, wrong env var names
- Nuxt-era idioms in `.docs/`: `U*` components, `NuxtLink`, `ContentRenderer`, `queryCollection`,
  `~/` aliases, `definePageMeta` as a macro, `nuxt.config.ts` / `app.config.ts`
- Relative links between docs pages — always use absolute paths (`/docs/plugins`), and no trailing
  slash before a hash (`/deploy#zero-config-providers`); broken links fail the prerender build
