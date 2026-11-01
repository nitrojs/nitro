import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  const order = (event.context.middlewareOrder ??= []) as string[];
  order.push(event.context.routeRules ? "rules" : "no-rules", "global");
  const echo = event.req.headers.get("x-echo");
  if (
    echo &&
    ["/rules/swr/middleware-order", "/api/cached-middleware"].includes(event.url.pathname)
  ) {
    event.res.headers.set("x-echo", echo);
  }
});
