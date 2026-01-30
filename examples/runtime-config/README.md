---
category: config
icon: i-lucide-settings
---

# Runtime Config

> Environment-aware configuration with runtime access.

<!-- automd:ui-code-tree src="." default="nitro.config.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="nitro.config.ts" expandAll}

```text [.env]
# NEVER COMMIT SENSITIVE DATA. THIS IS ONLY FOR DEMO PURPOSES.
NITRO_API_KEY=secret-api-key
```

```text [.gitignore]
# THIS IS ONLY FOR DEMO. DO NOT COMMIT SENSITIVE DATA IN REAL PROJECTS
!.env
```

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  runtimeConfig: {
    apiKey: "",
  },
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build"
  },
  "devDependencies": {
    "nitro": "latest"
  }
}
```

```ts [server.ts]
import { defineHandler } from "nitro/h3";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();
  return { runtimeConfig };
});
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

::

<!-- /automd -->

Runtime config lets you define configuration values that can be overridden by environment variables at runtime.

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
