import { defineMiddleware } from "nitro";

export default defineMiddleware((event) => {
  event.context.auth = { name: "User " + Math.round(Math.random() * 100) };
});
