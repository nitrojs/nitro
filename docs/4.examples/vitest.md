---
navigation:
  category: vite
icon: i-logos-vitest
---

# Vitest

> Test server routes with Vitest and `serverFetch`.

<!-- automd:ui-code-tree src="../../examples/vitest" default="test/api.test.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="test/api.test.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  runtimeConfig: {
    greeting: "Hello",
  },
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "test": "vitest"
  },
  "devDependencies": {
    "nitro": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
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

```ts [api/hello.ts]
import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler(() => {
  const { greeting } = useRuntimeConfig();
  return { message: `${greeting} from Nitro!` };
});
```

```ts [api/visits.ts]
import { defineHandler } from "nitro";
import { useKV } from "nitro/kv";

export default defineHandler(async () => {
  const kv = useKV<number>();
  const visits = ((await kv.getItem("visits")) || 0) + 1;
  await kv.setItem("visits", visits);
  return { visits };
});
```

```ts [test/api.test.ts]
import { beforeEach, expect, test } from "vitest";
import { serverFetch } from "nitro";
import { useKV } from "nitro/kv";

beforeEach(async () => {
  await useKV().removeItem("visits");
});

test("GET /api/hello", async () => {
  const res = await serverFetch("/api/hello");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "Hello from Nitro!" });
});

test("GET /api/visits", async () => {
  await serverFetch("/api/visits");
  const res = await serverFetch("/api/visits");
  expect(await res.json()).toEqual({ visits: 2 });
  expect(await useKV().getItem("visits")).toBe(2);
});
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/vitest/README.md" -->

Test your server routes with [Vitest](https://vitest.dev). Vitest picks up the `nitro()` plugin from `vite.config.ts`, so test files run with the same routes, runtime config and storage as your server, without starting a dev server.

## Routes

```ts [api/hello.ts]
import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler(() => {
  const { greeting } = useRuntimeConfig();
  return { message: `${greeting} from Nitro!` };
});
```

```ts [api/visits.ts]
import { defineHandler } from "nitro";
import { useKV } from "nitro/kv";

export default defineHandler(async () => {
  const kv = useKV<number>();
  const visits = ((await kv.getItem("visits")) || 0) + 1;
  await kv.setItem("visits", visits);
  return { visits };
});
```

## Tests

```ts [test/api.test.ts]
import { beforeEach, expect, test } from "vitest";
import { serverFetch } from "nitro";
import { useKV } from "nitro/kv";

beforeEach(async () => {
  await useKV().removeItem("visits");
});

test("GET /api/hello", async () => {
  const res = await serverFetch("/api/hello");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "Hello from Nitro!" });
});

test("GET /api/visits", async () => {
  await serverFetch("/api/visits");
  const res = await serverFetch("/api/visits");
  expect(await res.json()).toEqual({ visits: 2 });
  expect(await useKV().getItem("visits")).toBe(2);
});
```

`serverFetch` sends a request through your Nitro app in-process. Runtime utilities like `useKV` work in tests too, so you can prepare or inspect state directly.

Run the tests with `vitest`, or `vitest run` for a single run.

<!-- /automd -->

## Learn More

- [Testing](/docs/testing)
- [Server Fetch](/examples/server-fetch)
