import { defineHandler } from "nitro";
import { useNitroApp } from "nitro/app";
import { srvxPluginRuns } from "../../utils/srvx-plugin.ts";

export default defineHandler(async () => {
  const res = await useNitroApp().fetch(new Request("http://localhost/srvx-middleware"));
  return {
    body: await res.text(),
    plugin: res.headers.get("x-srvx-plugin"),
    pluginRuns: srvxPluginRuns.count,
  };
});
