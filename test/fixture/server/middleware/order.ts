import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  const order = (event.context.middlewareOrder ??= []) as string[];
  order.push(event.context.routeRules ? "rules" : "no-rules", "global");
  const echo = event.req.headers.get("x-echo");
  if (echo && event.url.pathname === "/rules/swr/middleware-order") {
    event.res.headers.set("x-echo", echo);
  }
});
