import { definePlugin } from "nitro";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("response", (event) => {
    event.headers.set("content-type", "html; charset=utf-8");
  });
});
