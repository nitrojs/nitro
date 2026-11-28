import { defineHandler } from "nitro";

export default defineHandler((event) => {
  event.context.user = "nitro";
});
