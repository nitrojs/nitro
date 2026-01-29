---
category: config
---

# Runtime Config

> Environment-aware configuration with runtime access.

Runtime config lets you define configuration values that can be overridden by environment variables at runtime.

<!-- automd:dir-tree -->

```
├── .env
├── .gitignore
├── nitro.config.ts
├── package.json
├── README.md
├── server.ts
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Define Config Schema

Declare your runtime config with default values in `nitro.config.ts`:

<!-- automd:file src="nitro.config.ts" code -->

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  runtimeConfig: {
    apiKey: "",
  },
});
```

<!-- /automd -->

## Access at Runtime

Use `useRuntimeConfig` to access configuration values in your handlers:

<!-- automd:file src="server.ts" code -->

```ts [server.ts]
import { defineHandler } from "nitro/h3";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();
  return { runtimeConfig };
});
```

<!-- /automd -->

## Environment Variables

Override config values via environment variables prefixed with `NITRO_`:

<!-- automd:file src=".env" code -->

```env [.env]
# NEVER COMMIT SENSITIVE DATA. THIS IS ONLY FOR DEMO PURPOSES.
NITRO_API_KEY=secret-api-key
```

<!-- /automd -->

## Learn More

- [Configuration](/docs/configuration)
