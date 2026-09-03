import { definePlugin } from "nitro";
import { useNitroHooks } from "nitro/app";

export default definePlugin(() => {
  const hooks = useNitroHooks();
  hooks.hook("response", (res) => {
    res.headers.set("content-type", "html; charset=utf-8");
  });
});
