# Platformatic

> Build Nitro applications for [Platformatic](https://platformatic.dev) Watt.

**Preset:** `platformatic` (alias: `watt`)

The `platformatic` preset extends `node-server`, keeping the standard `.output/server/index.mjs` entrypoint used by Watt.

:read-more{title="Run Nitro applications on Watt" to="https://blog.platformatic.dev/run-nitro-applications-on-watt-with-platformatic-nitro"}

## Usage

Select the preset in your Nitro config:

```ts [nitro.config.ts]
import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "platformatic",
});
```

Alternatively, pass the preset to the Nitro CLI:

```bash
nitro build --preset platformatic
```

## Scheduled tasks

When `scheduledTasks` are configured, the preset loads `@platformatic/nitro/scheduler` so Watt can coordinate task execution across workers.

For direct Nitro builds with scheduled tasks, install `@platformatic/nitro`:

```ts [nitro.config.ts]
import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "platformatic",
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    "0 3 * * *": ["db:cleanup"],
  },
});
```

Do not add `@platformatic/nitro/scheduler` to `modules` manually. The preset does not enable `experimental.tasks` and does not load the scheduler module when `scheduledTasks` is empty.
