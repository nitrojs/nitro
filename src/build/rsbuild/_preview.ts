import type { RsbuildPluginAPI } from "@rsbuild/core";
import type { IncomingMessage } from "node:http";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { getBuildInfo } from "../info.ts";
import { startPreview } from "../../preview.ts";

/** `rsbuild preview` serves the Nitro build output (server and public assets). */
export function setupPreview(api: RsbuildPluginAPI) {
  const rootDir = api.context.rootPath;

  // Rsbuild checks that its output exists (the common dir of all environments): the Nitro output
  // dir, not served by Rsbuild. Last, for environments added by other plugins too.
  api.modifyRsbuildConfig({
    order: "post",
    async handler(config, { mergeRsbuildConfig }) {
      const { outputDir } = await getBuildInfo({ rootDir });
      if (!outputDir) {
        return config;
      }
      const output = { distPath: { root: outputDir } };
      const environments = Object.fromEntries(
        Object.keys(config.environments || {}).map((name) => [name, { output }])
      );
      return mergeRsbuildConfig(config, { output, environments });
    },
  });

  api.onBeforeStartPreviewServer(async ({ server }) => {
    const preview = await startPreview({
      rootDir,
      loader: { nodeServer: server.httpServer as any },
    });
    server.httpServer?.once("close", () => preview.close());

    server.middlewares.use(async (req, res, next) => {
      try {
        await sendNodeResponse(res, await preview.fetch(new NodeRequest({ req, res })));
      } catch (error) {
        next(error);
      }
    });

    if (preview.upgrade) {
      server.httpServer?.on("upgrade", (req: IncomingMessage, socket, head) => {
        preview.upgrade!(req, socket as any, head);
      });
    }
  });
}
