---
category: config
---

# Import Alias

> Custom import aliases for cleaner module paths.

Import aliases like `~` and `#` let you reference modules with shorter paths instead of relative imports.

<!-- automd:dir-tree -->

```
├── server/
│   ├── routes/
│   │   └── index.ts
│   └── utils/
│       └── math.ts
├── nitro.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

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
