import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  if (!event.req.headers.get("authorization")) {
    return new Response("unauthorized", { status: 401 });
  }
});
