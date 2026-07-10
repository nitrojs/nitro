import { defineMiddleware } from "nitro";

// A trivial middleware — each request produces its own `middleware` span.
export default defineMiddleware((event) => {
  event.context.requestedAt = Date.now();
});
