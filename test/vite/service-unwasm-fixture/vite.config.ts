import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [nitro()],
  environments: {
    nitro: {
      resolve: { noExternal: ["@fixture/unwasm-dep"] },
    },
    ssr: {
      resolve: { noExternal: ["@fixture/unwasm-dep"] },
    },
  },
});
