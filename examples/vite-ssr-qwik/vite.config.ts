import { defineConfig, type Plugin } from "vite";
import { nitro } from "nitro/vite";
import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";

export default defineConfig(() => {
  return {
    plugins: [
      qwikRouter({ devSsrServer: false }),
      qwikVite({
        ssr: {
          input: "./src/entry-server.ts",
          outDir: "node_modules/.nitro/vite/services/ssr",
        },
      }),
      qwikPatches(),
      nitro({ noExternals: true }),
    ],
    environments: {
      ssr: {
        build: {
          rollupOptions: { input: "./src/entry-server.ts" },
        },
        resolve: {
          external: [
            // "@qwik.dev/core/build",
            // "@qwik.dev/core/preloader",
            // "@qwik.dev/core/server",
          ],
        },
      },
    },
  };
});

function qwikPatches(): Plugin {
  return {
    name: "qwik-patch-plugin",
    enforce: "pre",
    config() {},
    resolveId: {
      order: "pre",
      handler(id: string) {
        if (id === "@qwik-client-manifest") {
          return "virtual:qwik-client-manifest";
        }
      },
    },
    load: {
      order: "pre",
      handler(id: string) {
        if (id === "virtual:qwik-client-manifest") {
          return `export const manifest= {}`;
        }
      },
    },
    transform: {
      handler(code: string, id: string) {
        // ...
      },
    },
  };
}
