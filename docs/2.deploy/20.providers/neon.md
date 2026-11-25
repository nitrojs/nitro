# Neon Functions

> Deploy Nitro apps to Neon Functions.

**Preset:** `neon`

:read-more{title="Neon Functions" to="https://neon.com/docs/compute/functions/overview"}

[Neon Functions](https://neon.com/docs/compute/functions/overview) run Node.js 24 next to your Neon Postgres branch.

The `neon` preset builds your app into a single function. Nitro serves your routes, server-side rendering, and public assets from it, and maps Nitro features to the Neon runtime:

| Nitro feature | On Neon Functions |
| --- | --- |
| [Public assets](/docs/assets) | Served by the function from disk, with ETags and precompressed variants |
| [`event.waitUntil`](/docs/lifecycle) | Neon `waitUntil` (up to 15 minutes after the response) |
| [Database](/docs/database) | The branch's Postgres, with no connection string to configure |
| [Scheduled tasks](/docs/tasks) | [Neon Function Triggers](https://neon.com/docs/compute/functions/triggers/schedule) |
| [`shutdown` and `close` hooks](/docs/lifecycle#server-shutdown) | Called on `SIGINT`, before Neon stops an isolate |

## Deploy with the Neon CLI

1. Install the [Neon CLI](https://neon.com/docs/cli) and link your project to a Neon project and branch. Functions are available in [these regions](https://neon.com/docs/compute/functions/overview).

   ```bash
   npm install -g neon@latest
   neon link
   ```

2. Build your app with the `neon` preset:

   ```bash
   NITRO_PRESET=neon npx nitro build
   ```

   You can also set `preset: "neon"` in your Nitro config.

3. Deploy the `.output` directory as a prebuilt function:

   ```bash
   neon functions deploy myapp --src .output --no-bundle
   ```

   `myapp` is the function slug. It becomes part of the URL and can't be changed after the first deploy. A slug has 1 to 20 lowercase letters and digits, with no hyphens.

4. Get the public URL of your function:

   ```bash
   neon functions get myapp
   ```

::note
Deploy the whole `.output` directory, not `.output/server`. Nitro writes an `index.mjs` entry at the root of `.output` for Neon Functions to load, and serves public assets from `.output/public`.
::

## Deploy with `neon.ts`

To deploy your app with the rest of your Neon config, declare it in [`neon.ts`](https://neon.com/docs/reference/neon-ts) with `bundler: "none"`, so Neon ships the prebuilt output as is:

```ts [neon.ts]
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  functions: {
    myapp: {
      name: "My Nitro app",
      source: "./.output",
      bundler: "none",
    },
  },
});
```

Then build and deploy:

```bash
NITRO_PRESET=neon npx nitro build
neon deploy
```

## Environment variables

Neon injects the branch's service variables into every function at runtime, such as `DATABASE_URL`, `PGHOST`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`. See [Neon Functions environment variables](https://neon.com/docs/compute/functions/environment-variables).

Set your own variables at deploy time. Variables with the `NITRO_` prefix override [runtime config](/docs/configuration#runtime-configuration):

```bash
neon functions deploy myapp --src .output --no-bundle --env NITRO_API_TOKEN=secret
```

## Database

When [database](/docs/database) support is enabled, the `neon` preset sets the default connection to the branch's Postgres. The `postgresql` connector reads the variables that Neon injects, so you don't configure a connection string:

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  preset: "neon",
  experimental: {
    database: true,
  },
});
```

```ts [routes/users.ts]
import { defineHandler } from "nitro";
import { useDatabase } from "nitro/database";

export default defineHandler(async () => {
  const db = useDatabase();
  const { rows } = await db.sql`SELECT * FROM users LIMIT 10`;
  return rows;
});
```

::warning
Don't use SQLite connectors on Neon Functions. The filesystem is read-only outside `/tmp`, and `/tmp` is local to each isolate and lost when the isolate stops.
::

## WebSockets

The `neon` preset doesn't support Nitro [WebSockets](/docs/websocket) yet. With `features.websocket` enabled, the build logs a warning, and WebSocket clients get a `426 Upgrade Required` response.

For one-way, server-to-client updates, stream a response with [server-sent events](https://neon.com/docs/compute/functions/websockets#server-sent-events-sse).

## Scheduled tasks

Neon runs [scheduled tasks](/docs/tasks#scheduled-tasks) with [Function Triggers](https://neon.com/docs/compute/functions/triggers/schedule). For each cron expression in `scheduledTasks`, Nitro writes a function path to `.output/neon.json`:

```json [.output/neon.json]
{
  "triggers": [
    {
      "cron": "0 3 * * *",
      "functionPath": "/_neon/cron/MCAzICogKiAq",
      "tasks": ["db:cleanup"]
    }
  ]
}
```

Create a schedule trigger for each entry, pointing at its `functionPath`:

```bash
neon triggers create --function-slug myapp --name db-cleanup \
  --cron "0 3 * * *" --function-path /_neon/cron/MCAzICogKiAq
```

Or declare the triggers in `neon.ts`:

```ts [neon.ts]
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  functions: {
    myapp: { name: "My Nitro app", source: "./.output", bundler: "none" },
  },
  triggers: {
    "db-cleanup": {
      type: "schedule",
      function: "myapp",
      cron: "0 3 * * *",
      functionPath: "/_neon/cron/MCAzICogKiAq",
    },
  },
});
```

Neon evaluates schedules in UTC and accepts only five numeric fields, so names like `MON`, macros like `@daily`, and a seconds field are rejected. Each task receives the trigger's scheduled time as `payload.scheduledTime`. Nitro rejects requests to these paths that don't come from Neon.

## Caching and storage

Every isolate has its own memory. The default in-memory [KV storage](/docs/storage) and [cache](/docs/cache) are not shared between isolates and are lost when an isolate stops. For data that must persist or be shared, use the branch's Postgres, or mount a KV driver backed by an external service.

## Preview locally

To preview the build locally, run:

```bash
npx srvx --prod .output
```

`event.waitUntil` and scheduled trigger deliveries need the Neon Functions runtime, so test them on a deployed function.
