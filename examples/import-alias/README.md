---
category: config
icon: i-lucide-at-sign
---

# Import Alias

> Custom import aliases for cleaner module paths.

<!-- automd:ui-code-tree src="." default="server/routes/index.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="server/routes/index.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: true,
  experimental: {
    tsconfigPaths: true,
  },
});
```

```json [package.json]
{
  "type": "module",
  "imports": {
    "#server/*": "./server/*"
  },
  "scripts": {
    "build": "nitro build",
    "dev": "nitro dev",
    "preview": "node .output/server/index.mjs"
  },
  "devDependencies": {
    "nitro": "latest"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig",
  "compilerOptions": {
    "paths": {
      "~server/*": ["./server/*"]
    }
  }
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

```ts [server/routes/index.ts]
import { sum } from "~server/utils/math.ts";

import { rand } from "#server/utils/math.ts";

export default () => {
  const [a, b] = [rand(1, 10), rand(1, 10)];
  const result = sum(a, b);
  return `The sum of ${a} + ${b} = ${result}`;
};
```

```ts [server/utils/math.ts]
export function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sum(a: number, b: number): number {
  return a + b;
}
```

::

<!-- /automd -->

Import aliases like `~` and `#` let you reference modules with shorter paths instead of relative imports.

## Importingi Using Aliases

<!-- automd:file src="server/routes/index.ts" code -->

```ts [index.ts]
import { sum } from "~server/utils/math.ts";

import { rand } from "#server/utils/math.ts";

export default () => {
  const [a, b] = [rand(1, 10), rand(1, 10)];
  const result = sum(a, b);
  return `The sum of ${a} + ${b} = ${result}`;
};
```

<!-- /automd -->

The route imports the `sum` function using `~server/` and `rand` using `#server/`. Both resolve to the same `server/utils/math.ts` file. The handler generates two random numbers and returns their sum.

<!-- /automd -->

## Configuration

Aliases can be configured in `package.json` imports field or `nitro.config.ts`.

## Learn More

- [Configuration](/docs/configuration)
