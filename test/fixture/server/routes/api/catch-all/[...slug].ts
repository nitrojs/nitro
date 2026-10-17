import { defineHandler } from "nitro/h3";

export default defineHandler((event) => ({
  route: "catch-all",
  params: event.context.params,
}));
