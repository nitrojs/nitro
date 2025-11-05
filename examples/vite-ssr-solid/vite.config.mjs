import solid from "vite-plugin-solid";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [solid({ ssr: true }), nitro()],
  esbuild: { jsx: "preserve", jsxImportSource: "solid-js" },
  environments: {
    ssr: {
      resolve: { noExternal: true /* fixes tests */ },
      build: { rollupOptions: { input: "./src/entry-server.tsx" } },
    },
    client: {
      build: { rollupOptions: { input: "./src/entry-client.tsx" } },
    },
  },
});
