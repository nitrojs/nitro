import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  compatibilityDate: "latest",
  renderer: "./app/server",
});
