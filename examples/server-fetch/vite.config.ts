import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { serverFetch } from "nitro";

export default defineConfig({
  plugins: [
    nitro(),
    {
      name: "my-nitro-plugin",
      configureServer: {
        order: "post",
        async handler() {
          setTimeout(async () => {
            const res = await serverFetch("/hello").then((r) => r.text());
            console.log("Fetched /hello in vite plugin:", res);
          }, 1000);
        },
      },
    },
  ],
});
