---
category: config
---

# Runtime Config

> Environment-aware configuration with runtime access.

## Project Structure

```
runtime-config/
├── .env                  # Environment variables
├── server.ts             # Access runtime config
├── nitro.config.ts       # Define config schema
└── vite.config.ts
```

## How It Works

### Define Config Schema

Declare your runtime config in `nitro.config.ts`:

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  runtimeConfig: {
    apiKey: "",
  },
});
```

### Access at Runtime

Use `useRuntimeConfig` to access values:

```ts [server.ts]
import { defineHandler } from "nitro/h3";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();
  return { runtimeConfig };
});
```

### Environment Variables

Set values via environment variables prefixed with `NITRO_`:

```bash [.env]
NITRO_API_KEY=your-secret-key
```

## Learn More

- [Configuration](/docs/configuration)
