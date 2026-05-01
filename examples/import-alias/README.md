Import aliases like `~` and `#` let you reference modules with shorter paths instead of relative imports.

## Importing Using Aliases

```ts [server/routes/index.ts]
import { sum } from "~server/utils/math.ts";

import { rand } from "#server/utils/math.ts";

export default () => {
  const [a, b] = [rand(1, 10), rand(1, 10)];
  const result = sum(a, b);
  return `The sum of ${a} + ${b} = ${result}`;
};
```

The route imports the `sum` function using `~server/` and `rand` using `#server/`. Both resolve to the same `server/utils/math.ts` file. The handler generates two random numbers and returns their sum.

## Configuration

Aliases can be configured in `package.json` imports field or `nitro.config.ts`.
