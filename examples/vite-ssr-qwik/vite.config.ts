import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig(() => {
  return {
    plugins: [
      qwikRouter({ devSsrServer: false }),
      qwikVite({ ssr: { input: "src/entry.server" } }),
      nitro(),
    ],
  };
});
