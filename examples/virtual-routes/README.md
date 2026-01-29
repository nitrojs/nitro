---
category: features
---

# Virtual Routes

> Define routes programmatically using Nitro's virtual module system.

Virtual routes let you define handlers as strings in your config instead of creating separate files. This is useful when generating routes dynamically, building plugins, or keeping simple routes inline.

<!-- automd:dir-tree -->

```
├── nitro.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Configuration

<!-- automd:file src="nitro.config.ts" code -->

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  routes: {
    "/": "#virtual-route",
  },
  virtual: {
    "#virtual-route": () =>
      /* js */ `export default () => new Response("Hello from virtual entry!")`,
  },
});
```

<!-- /automd -->

The `routes` option maps URL paths to virtual module identifiers (prefixed with `#`). The `virtual` option defines the module content as a string or function returning a string. At build time, Nitro resolves these virtual modules to actual handlers.

There are no route files in this project. The entire handler is defined inline in the config, and Nitro generates the route at build time.

## Learn More

- [Routing](/docs/routing)
- [Configuration](/docs/configuration)
