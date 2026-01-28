---
category: config
---

# Import Alias

> Custom import aliases for cleaner module paths.

## Project Structure

```
import-alias/
├── server/
│   ├── routes/
│   │   └── index.ts      # Route using aliases
│   └── utils/
│       └── math.ts       # Utility module
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Import modules using configured aliases:

```ts [server/routes/index.ts]
import { sum } from "~server/utils/math.ts";
import { rand } from "#server/utils/math.ts";

export default () => {
  const [a, b] = [rand(1, 10), rand(1, 10)];
  const result = sum(a, b);
  return `The sum of ${a} + ${b} = ${result}`;
};
```

Aliases can be configured in `package.json` imports field or `nitro.config.ts`.

## Learn More

- [Configuration](/docs/configuration)
