---
category: config
---

# Auto Imports

> Automatic imports for utilities and composables.

## Project Structure

```
auto-imports/
├── server/
│   └── utils/
│       └── hello.ts      # Auto-imported utility
├── server.ts             # Uses auto-imported function
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

### Defining Utilities

Create utilities in `server/utils/`:

```ts [server/utils/hello.ts]
export function makeGreeting(name: string) {
  return `Hello, ${name}!`;
}
```

### Using Auto-Imports

Utilities are automatically available without explicit imports:

```ts [server.ts]
import { defineHandler } from "nitro/h3";
import { makeGreeting } from "./server/utils/hello.ts";

export default defineHandler(() => `<h1>${makeGreeting("Nitro")}</h1>`);
```

## Learn More

- [Configuration](/docs/configuration)
