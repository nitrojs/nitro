import { definePlugin } from "nitro";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("response", (res) => {
    res.headers.set("x-plugin", "1");
  });
});
