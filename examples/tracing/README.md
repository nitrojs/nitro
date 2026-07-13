Nitro can instrument its request lifecycle through Node [diagnostics channels](https://nodejs.org/api/diagnostics_channel.html) — no OpenTelemetry SDK required. This example turns instrumentation on and enables the built-in console logger, which groups every h3, srvx and unstorage span into a per-request timeline (waterfall).

## Enabling tracing

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  // Instrument the h3, srvx and unstorage tracing channels.
  tracingChannel: true,

  experimental: {
    // Log every completed span to the console (built-in, dependency-free sink).
    tracingLogger: true,
  },
});
```

`tracingChannel: true` wires up the producers (it accepts `{ h3, srvx, unstorage }` to trace a subset). `experimental.tracingLogger` adds a built-in sink that `console.log`s each completed span — a dependency-free alternative to a vendor exporter, handy for local development.

## Try it

```sh
npm run dev
# then, in another terminal:
curl http://localhost:3000/
curl http://localhost:3000/users/42
```

Each request prints a timeline of its spans to the console — the middleware, the matched route, and every storage operation, positioned and sized by when they ran and how long they took:

```
▶ GET /  4.10ms  (4 spans)
  middleware GET /             █·······················   0.12ms h3.handler_type=middleware http.route=/
  GET /                        ·███████████████████·····   2.49ms h3.handler_type=route http.route=/
  getItem                      ···██····················   0.18ms db.operation=getItem db.system=memory unstorage.keys_count=1
  setItem                      ·····██··················   0.16ms db.operation=setItem db.system=memory unstorage.keys_count=1
```

The header line (`▶`) is the request itself — its method, path and total time; the rows below are the spans that ran within it. Note the dynamic route is named by its matched template — `GET /users/:id`, not `/users/42` — keeping span names low-cardinality per the OpenTelemetry HTTP conventions.

The request boundary comes from Nitro's `request`/`response` runtime hooks, so grouping works identically in `vite dev` and in a production build. Spans are grouped per request via async context, so timelines for concurrent requests stay separate, and a failed span is marked `✖` with its error message.

## What gets traced

| Channel | Span | Emitted by |
| --- | --- | --- |
| `h3.request` | each matched route and middleware | `server/routes/*`, `server/middleware/*` |
| `unstorage.*` | each storage operation (`getItem`, `setItem`, …) | `useStorage()` in `server/routes/index.ts` |
| `srvx.request` | the whole request, with response status (production server) | the srvx server layer |
