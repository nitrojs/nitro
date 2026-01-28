---
category: features
---

# Virtual Routes

> Define routes programmatically using Nitro's virtual module system.

## Project Structure

```
virtual-routes/
├── nitro.config.ts       # Virtual route configuration
└── vite.config.ts
```

## How It Works

Define virtual routes in your Nitro configuration:

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  routes: {
    "/": "#virtual-route",
  },
  virtual: {
    "#virtual-route": () =>
      `export default () => new Response("Hello from virtual entry!")`,
  },
});
```

### How Virtual Modules Work

1. The `routes` option maps URL paths to virtual module identifiers
2. The `virtual` option defines the module content as a string or function
3. At build time, Nitro resolves these virtual modules

## Learn More

- [Routing](/docs/routing)
- [Configuration](/docs/configuration)
