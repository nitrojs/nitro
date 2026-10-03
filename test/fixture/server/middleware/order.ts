import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  const order = (event.context.middlewareOrder ??= []) as string[];
  order.push(event.context.routeRules ? "rules" : "no-rules", "global");
});
