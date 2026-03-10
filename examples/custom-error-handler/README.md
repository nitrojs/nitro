This example shows how to intercept all errors and return a custom response format. When any route throws an error, Nitro calls your error handler instead of returning the default error page.

## Error Handler

Create an `error.ts` file in your project root to define the global error handler:

```ts [error.ts]
import { defineErrorHandler } from "nitro";

export default defineErrorHandler((error, _event) => {
  return new Response(`Custom Error Handler: ${error.message}`, {
    status: 500,
    headers: { "Content-Type": "text/plain" },
  });
});
```

The handler receives the thrown error and the H3 event object. You can use the event to access request details like headers, cookies, or the URL path to customize responses per route.

## Triggering an Error

The main handler throws an error to demonstrate the custom error handler:

```ts [server.ts]
import { defineHandler, HTTPError } from "nitro/h3";

export default defineHandler(() => {
  throw new HTTPError("Example Error!", { status: 500 });
});
```

When you visit the page, instead of seeing a generic error page, you'll see "Custom Error Handler: Example Error!" because the error handler intercepts the thrown error.
