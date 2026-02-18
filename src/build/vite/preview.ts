import type { Plugin as VitePlugin } from "vite";
import type { NitroPluginContext } from "./types.ts";
import { startPreview } from "../../preview.ts";

export function nitroPreviewPlugin(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:preview",
    apply: (_config, configEnv) => !!configEnv.isPreview,

    config(config) {
      return {
        preview: {
          port: config.preview?.port || 3000,
        },
      };
    },

    async configurePreviewServer(server) {
      // Init Nitro preview handler
      const preview = await startPreview(server.config.root);

      // Close preview server when Vite's preview server is closed
      server.httpServer.once("close", async () => {
        await preview.close();
      });
      for (const sig of ["SIGINT", "SIGHUP"] as const) {
        process.on(sig, async () => {
          await preview.close();
        });
      }

      // Handle all requests with Nitro preview handler (also handles production static assets)
      const { NodeRequest, sendNodeResponse } = await import("srvx/node");
      server.middlewares.use(async (req, res, next) => {
        const nodeReq = new NodeRequest({ req, res });
        const previewRes: Response = await preview.fetch(nodeReq);
        await sendNodeResponse(res, previewRes).catch(next);
      });
    },
  } satisfies VitePlugin;
}
