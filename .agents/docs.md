# Documentation Guide

## Structure

Documentation lives in `docs/` and is built with [UnDocs](https://github.com/unjs/undocs).

```
docs/
  .docs/          # UnDocs Nuxt app (components, pages, layouts, utils)
  .config/        # docs.yaml (site config), automd.config.ts
  1.docs/         # Core documentation (getting started, routing, cache, etc.)
  2.deploy/       # Deployment docs (runtimes, providers)
  3.config/       # Config reference
  4.examples/     # Examples index
  index.md        # Homepage
```

Numeric prefixes control navigation order. Files with the same prefix are sorted alphabetically.

## Conventions

### Preset Names

Canonical preset names use **underscores** (e.g., `node_server`, `cloudflare_module`, `digital_ocean`). Both underscores and hyphens are supported at runtime (resolved via `kebabCase`), but docs should use underscore form.

### Import Paths

Nitro v3 uses subpath exports — not deep runtime imports:

```ts
import { defineHandler, readBody, getQuery } from "nitro/h3";
import { defineCachedHandler, defineCachedFunction } from "nitro/cache";
import { useStorage } from "nitro/storage";
import { useDatabase } from "nitro/database";
import { useRuntimeConfig } from "nitro/runtime-config";
import { defineNitroConfig } from "nitro/config";
import { definePlugin } from "nitro";        // runtime plugin
import { defineRouteMeta } from "nitro";      // route meta macro
```

### H3 v2 API

Nitro v3 uses H3 v2. Key differences from v1:

- **Handler**: `defineHandler()` (not `eventHandler` / `defineEventHandler`)
- **Error**: `throw new HTTPError(message, { status })` (not `createError()`)
- **Router**: `new H3()` (not `createApp()` / `createRouter()`)
- **Response**: Return values directly; no `send()` function
- **Headers**: `event.res.headers.set(name, value)` (not `setResponseHeader(event, name, value)`)
- **Hooks**: `request` hook receives `(event: HTTPEvent)`, not `(req)`

### Code Examples

- **Auto imports are not available** — always show explicit imports in examples
- Always use `defineHandler` from `"nitro/h3"` (not `eventHandler`)
- Always use `defineNitroConfig` from `"nitro/config"` (not `defineConfig`)
- Include import statements in code examples
- Use `"nitro/*"` imports, never `"nitropack/*"`

### Node.js Version

Nitro v3 requires Node.js >= 20. All deployment docs should reference Node.js 20+ (not 16 or 18).

### Environment Variables

The preset env var is `NITRO_PRESET` (not `SERVER_PRESET` or any other name).

### Runtime Config

- Prefix: `NITRO_` for env var overrides
- camelCase in config, UPPER_SNAKE_CASE in env vars

## Common Mistakes to Avoid

- Using `send(event, value)` — removed in h3 v2, return values directly
- Using `createError()` — use `new HTTPError()` or `HTTPError.status()`
- Using `eventHandler()` — use `defineHandler()`
- Using `defineConfig()` for nitro config — use `defineNitroConfig()`
- Duplicate imports (e.g., importing `defineHandler` from both `nitro/h3` and `nitro/cache`)
- Wrong env var names (e.g., `NITR_PRESET`, `SERVER_PRESET`)
- Outdated Node.js versions in deployment examples
- Using hyphen preset names in docs (use underscores)

## MDC Syntax Reference

Docs use [MDC](https://content.nuxt.com/) (Markdown Components) syntax to embed Vue components in markdown.

### Block Components

Use `::` for block components. Nesting increases the colon count:

```markdown
::component-name
Content here
::

::component{prop="value" boolProp}
Content
::
```

Nested (each level adds one `:`):

```markdown
::parent
  :::child
  Content
  :::
::
```

### Props

**Inline:** `::alert{type="warning" icon="i-lucide-alert"}`

**YAML block** (for multiple props):

```markdown
::component
---
title: My Title
icon: i-lucide-rocket
---
Content
::
```

### Slots

Named slots use `#`:

```markdown
::hero
Default slot content

#title
Title slot content

#description
Description slot content

#links
  :::u-button{to="/docs"}
  Get Started
  :::
::
```

### Inline Components & Attributes

```markdown
:inline-component{prop="value"}

Hello [World]{.text-primary style="color: green;"}
```

### Variables

```markdown
---
title: My Page
---
# {{ $doc.title }}
```

## Prose Components (Typography)

These are available in markdown files for documentation content. Provided by [Nuxt UI](https://ui.nuxt.com/).

### Callouts

```markdown
::note
Additional information for the user.
::

::tip
Helpful suggestion or best practice.
::

::warning
Caution about potential unexpected results.
::

::caution
Warning about irreversible or dangerous actions.
::
```

Generic callout with props:

```markdown
::callout{icon="i-lucide-info" color="primary"}
Custom callout content with **markdown**.
::
```

Colors: `primary`, `secondary`, `success`, `info`, `warning`, `error`, `neutral`.

### Tabs

```markdown
::tabs
  :::tabs-item{label="npm" icon="i-lucide-package"}
  ```bash
  npm install nitro
  ```
  :::
  :::tabs-item{label="pnpm"}
  ```bash
  pnpm add nitro
  ```
  :::
::
```

Props: `orientation` (`horizontal`|`vertical`), `defaultValue`, `content`, `unmountOnHide`.

### Steps

```markdown
::steps{level="3"}
### Install
Install the package.

### Configure
Add to your config.

### Deploy
Deploy your app.
::
```

`level` prop: `"2"`, `"3"` (default), `"4"` — determines which heading level becomes numbered steps.

### Code Group

```markdown
::code-group
```ts [nuxt.config.ts]
export default defineNuxtConfig({})
```
```ts [nitro.config.ts]
export default defineNitroConfig({})
```
::
```

Props: `defaultValue`, `sync` (persists selection to localStorage).

### Code Tree

Interactive file tree with code preview:

```markdown
::code-tree{defaultValue="routes/hello.ts" expand-all}
  ::prose-pre{filename="routes/hello.ts"}
  ```ts
  export default defineHandler(() => 'Hello!')
  ```
  ::
  ::prose-pre{filename="vite.config.ts"}
  ```ts
  import { nitro } from 'nitro/vite'
  export default defineConfig({ plugins: [nitro()] })
  ```
  ::
::
```

Props: `defaultValue`, `expandAll`, `items`.

### Card

```markdown
::card{title="Storage" icon="i-lucide-database" to="/docs/storage"}
Access key-value storage in your handlers.
::
```

Props: `title`, `icon`, `color`, `to`, `target`, `variant` (`solid`|`outline`|`soft`|`subtle`).

### Field

Document API parameters:

```markdown
::field{name="preset" type="string" required}
The deployment preset to use.
::
```

Props: `name`, `type`, `description`, `required`.

### Collapsible

```markdown
::collapsible{name="Advanced Options"}
Hidden content shown on expand.
::
```

Props: `name`, `size`, `color`, `defaultOpen`, `unmountOnHide`.

### Kbd (Keyboard)

`:kbd[Ctrl]` + `:kbd[C]` renders keyboard shortcuts inline.

### Icon

`:icon{name="i-lucide-rocket"}` renders an inline icon.

### Prose Pre (Code Block)

Explicit code block with filename:

```markdown
::prose-pre{filename="server.ts"}
```ts
export default { fetch: () => new Response('ok') }
```
::
```

## Landing Page Components

These are Nuxt UI `Page*` components used in `docs/index.md` for the homepage. Prefix with `u-` in MDC.

### PageHero (`::u-page-hero`)

```markdown
::u-page-hero
---
orientation: horizontal
---
#title
Ship [Full-Stack]{.text-primary} Vite Apps

#description
Build production-ready server applications.

#links
  :::u-button{size="xl" to="/docs"}
  Get Started
  :::

#default
  :::some-illustration
  :::
::
```

Props: `title`, `description`, `headline`, `orientation` (`vertical`|`horizontal`), `reverse`, `links` (ButtonProps[]).
Slots: `top`, `header`, `headline`, `title`, `description`, `body`, `footer`, `links`, `default`, `bottom`.

### PageSection (`::u-page-section`)

```markdown
::u-page-section
---
orientation: horizontal
features:
  - title: Feature One
    description: Description here
    icon: i-lucide-zap
---
#title
Section Title

#description
Section description text.
::
```

Props: `headline`, `icon`, `title`, `description`, `orientation`, `reverse`, `links` (ButtonProps[]), `features` (PageFeatureProps[]).
Slots: `top`, `header`, `leading`, `headline`, `title`, `description`, `body`, `features`, `footer`, `links`, `default`, `bottom`.

### PageFeature (`::u-page-feature`)

```markdown
:::::u-page-feature
#title
Feature Name

#description
Feature description text.
:::::
```

Props: `icon`, `title`, `description`, `orientation` (`horizontal`|`vertical`), `to`, `target`.
Slots: `leading`, `title`, `description`, `default`.

### PageGrid (`::u-page-grid`)

Responsive grid (1→2→3 columns). Wraps `PageCard` or `PageFeature` children:

```markdown
::::u-page-grid
  :::::u-page-card{title="Card" icon="i-lucide-box"}
  Card content
  :::::
::::
```

### PageCard (`::u-page-card`)

```markdown
::u-page-card{title="Title" icon="i-lucide-box" to="/link"}
Card body content.
::
```

Props: `icon`, `title`, `description`, `orientation`, `reverse`, `highlight`, `highlightColor`, `spotlight`, `spotlightColor`, `variant`, `to`, `target`.
Slots: `header`, `leading`, `title`, `description`, `body`, `footer`, `default`.

### PageCTA (`::u-page-cta`)

Call-to-action block:

```markdown
::u-page-cta
---
variant: solid
links:
  - label: Get Started
    to: /docs
    color: neutral
---
#title
Ready to get started?

#description
Deploy your app in minutes.
::
```

Props: `title`, `description`, `orientation`, `reverse`, `variant` (`outline`|`solid`|`soft`|`subtle`|`naked`), `links`.

### PageLogos (`::u-page-logos`)

```markdown
::u-page-logos
---
title: Trusted by
marquee: true
items:
  - i-simple-icons-github
  - i-simple-icons-vercel
---
::
```

Props: `title`, `items` (icon strings or `{src, alt}` objects), `marquee` (boolean or MarqueeProps).

### PageLinks (`::u-page-links`)

```markdown
::u-page-links
---
title: Community
links:
  - label: GitHub
    icon: i-simple-icons-github
    to: https://github.com/nitrojs/nitro
---
::
```

### Other Page Components

- **PageHeader** — Page title/description header
- **PageBody** — Main content wrapper
- **PageColumns** — Multi-column layout
- **PageList** — Vertical list of items
- **PageAnchors** — Anchor link navigation
- **PageAside** — Sidebar content

## Nuxt Content Querying (for custom components)

```ts
// Single page by path
const page = await queryCollection('docs').path('/hello').first()

// Filtered list
const posts = await queryCollection('blog')
  .where('draft', '=', false)
  .order('date', 'DESC')
  .all()

// Navigation tree
const nav = await queryCollectionNavigation('docs')

// Prev/next
const [prev, next] = await queryCollectionItemSurroundings('docs', '/current')
```

## Custom Components

Project-specific components live in `docs/.docs/components/` and can be used in markdown with `:component-name` or `::component-name` syntax (e.g., `:page-sponsors`, `:hero-background` as seen in `index.md`).
