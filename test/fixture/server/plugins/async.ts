import { definePlugin } from "nitro";

export default definePlugin(async (nitroApp) => {
  const value = await Promise.resolve("async plugin works!");
  nitroApp.hooks.hook("response", (res) => {
    res.headers.set("x-async-plugin", value);
  });
});
