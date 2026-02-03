The simplest Nitro server. Export an object with a `fetch` method that receives a standard `Request` and returns a `Response`. No frameworks, no abstractions, just the web platform.


## Server Entry

```ts [server.ts]
export default {
  fetch(req: Request) {
    return new Response("Nitro Works!");
  },
};
```

The `fetch` method follows the same signature as Service Workers and Cloudflare Workers. This pattern works across all deployment targets because it uses web standards.

Add the Nitro plugin to Vite and it handles the rest: dev server, hot reloading, and production builds.
