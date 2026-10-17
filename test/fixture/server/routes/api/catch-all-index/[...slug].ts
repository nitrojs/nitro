import { defineHandler } from "nitro/h3";

export default defineHandler((event) => ({
  route: "catch-all",
  slug: event.context.params?.slug ?? null,
}));
