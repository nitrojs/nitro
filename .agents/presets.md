# Nitro Presets Reference

## All Presets (31)

### Core
- `_nitro/` — Internal presets (dev, prerender, worker modes)
- `standard/` — Framework-agnostic standard server
- `node/` — Node.js (server, middleware, cluster)
- `bun/` — Bun runtime

### Cloud Providers
- `aws-lambda/` — AWS Lambda
- `aws-amplify/` — AWS Amplify
- `azure/` — Azure Static Web Apps
- `cloudflare/` — Cloudflare Pages/Workers
- `deno/` — Deno Deploy
- `firebase/` — Firebase Hosting
- `netlify/` — Netlify Functions/Edge
- `vercel/` — Vercel Functions/Edge
- `digitalocean/` — DigitalOcean App Platform
- `heroku/` — Heroku
- `koyeb/` — Koyeb
- `zeabur/` — Zeabur
- `render.com/` — Render
- `stormkit/` — Stormkit
- `genezio/` — Genezio
- `winterjs/` — WinterJS
- `zephyr/` — Zephyr
- `alwaysdata/`
- `cleavr/`
- `flightcontrol/`
- `iis/`
- `platform.sh/`

## Preset Structure

```
presets/<name>/
├── preset.ts        # defineNitroPreset() — config overrides, hooks
├── runtime/         # Runtime entry points (bundled into output)
│   └── <name>.ts    # Platform-specific request handler
├── types.ts         # TypeScript types (optional)
├── utils.ts         # Build-time utilities (optional)
└── unenv/           # Environment polyfill overrides (optional)
    ├── preset.ts
    └── node-compat.ts
```

## Creating a Preset

Use `defineNitroPreset()` from `src/presets/_utils/preset.ts`:

```ts
import { defineNitroPreset } from "../_utils/preset.ts";

export default defineNitroPreset({
  // Preset metadata
  entry: "./runtime/<name>.ts",
  // NitroConfig overrides
  node: false,
  // Hooks
  hooks: {
    "build:before": async (nitro) => { /* ... */ },
  },
});
```

## Preset Resolution (`presets/_resolve.ts`)

`resolvePreset(name, opts)` considers:
- Preset name aliases
- Dev vs production mode
- Compatibility dates
- Static hosting detection
- Generated mappings in `_all.gen.ts` and `_types.gen.ts`
