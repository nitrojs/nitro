This example shows how to use [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) with Nitro — in production and in local dev, where `vite dev` runs your app inside [workerd](https://github.com/cloudflare/workerd) via Miniflare.

## Defining a Durable Object

Durable Object classes are regular classes extending `DurableObject`:

```ts [server/durable/counter.ts]
import { DurableObject } from "cloudflare:workers";

export class CounterDO extends DurableObject {
  async increment(amount: number = 1): Promise<number> {
    const count = ((await this.ctx.storage.get<number>("count")) ?? 0) + amount;
    await this.ctx.storage.put("count", count);
    return count;
  }
}
```

They are exported to the worker entrypoint through `exports.cloudflare.ts`:

```ts [exports.cloudflare.ts]
export { CounterDO } from "./server/durable/counter.ts";
```

And bound in `wrangler.jsonc`:

```jsonc [wrangler.jsonc]
{
  "durable_objects": {
    "bindings": [{ "name": "COUNTER", "class_name": "CounterDO" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["CounterDO"] }]
}
```

## Calling a Durable Object

The namespace binding is available from the request event:

```ts [routes/counter.ts]
import { defineHandler } from "nitro";

export default defineHandler(async (event) => {
  const env = event.req.runtime?.cloudflare?.env;
  const count = await env.COUNTER.getByName("global").increment();
  return { count };
});
```

Run `vite dev` and fetch `/counter` — the count increments in a real Durable Object running in workerd. Route handlers are hot-reloaded; after changing the Durable Object class itself, restart the dev server.
