When you need one route to call another, use Nitro's `serverFetch` function. It makes internal requests that stay in-process, avoiding network round-trips. The request never leaves the server.

## Main Route

```ts [routes/index.ts]
import { defineHandler, serverFetch } from "nitro";

export default defineHandler(() => serverFetch("/hello"));
```

The index route imports `serverFetch` from `nitro` and calls the `/hello` route. This request is handled internally without going through the network stack.

## Internal API Route

```ts [routes/hello.ts]
import { defineHandler } from "nitro";

export default defineHandler(() => "Hello!");
```

A simple route that returns "Hello!". When the index route calls `serverFetch("/hello")`, this handler runs and its response is returned directly.
