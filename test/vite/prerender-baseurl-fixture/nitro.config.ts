import { defineConfig } from "nitro";

export default defineConfig({
  preset: "static",
  baseURL: "/base/",
  prerender: { routes: ["/"], crawlLinks: true, ignore: ["/admin"] },
});
