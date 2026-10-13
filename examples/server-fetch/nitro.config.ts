import { defineConfig, serverFetch } from "nitro";

export default defineConfig({
  serverDir: "./",
  hooks: {
    "dev:start": async () => {
      const res = await serverFetch("/hello");
      const text = await res.text();
      console.log("Fetched /hello in nitro module:", res.status, text);
    },
  },
});
