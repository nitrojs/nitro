import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { nitro } from "nitro/rsbuild";

export default defineConfig({
  plugins: [
    pluginReact(),
    // Nitro serves the `ssr` environment (pages, server functions and server routes)
    tanstackStart({ rsbuild: { installDevServerMiddleware: false } }),
    nitro(),
  ],
});
