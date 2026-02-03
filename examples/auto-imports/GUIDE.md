Functions exported from `server/utils/` are automatically available without explicit imports when auto-imports are enabled. Define a utility once and use it anywhere in your server code.

## Configuration

Enable auto-imports by setting `imports` in your config:

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: true,
  imports: {},
});
```

## Using Auto Imports

1. Create a utility file in `server/utils/`:

```ts [server/utils/hello.ts]
export function makeGreeting(name: string) {
  return `Hello, ${name}!`;
}
```

2. The function is available without importing it:

```ts [server.ts]
import { defineHandler } from "nitro/h3";
import { makeGreeting } from "./server/utils/hello.ts";

export default defineHandler(() => `<h1>${makeGreeting("Nitro")}</h1>`);
```

With this setup, any function exported from `server/utils/` becomes globally available. Nitro scans the directory and generates the necessary imports automatically.
