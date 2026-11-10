import type { RsbuildPluginAPI } from "@rsbuild/core";
import type { Nitro } from "nitro/types";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { NitroRsbuildContext } from "./_context.ts";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { withBase } from "ufo";
import { createDevServer, type NitroDevServer } from "../../dev/server.ts";
import { hasEmittedAssets } from "../rspack/dev.ts";
import { useNitro } from "./_context.ts";
import { isAssetRequest, isExplicitRoute, isPageRequest, type DevApp } from "./_dev-routing.ts";

type Next = (error?: unknown) => void;

interface NitroDevRequest extends IncomingMessage {
  _nitroAssetCheck?: boolean;
}

/**
 * Serves Nitro from the Rsbuild dev server: explicit Nitro routes are handled before the Rsbuild
 * middlewares (compiled assets, public dir and HTML pages), any other request after them.
 * The `nitro` environment is written to disk and reloads the Nitro dev worker after each build.
 */
export function setupDevServer(api: RsbuildPluginAPI, ctx: NitroRsbuildContext) {
  api.onAfterCreateCompiler(() => {
    for (const compiler of ctx.compilers || []) {
      if (compiler.name && ctx.services?.[compiler.name]) {
        compiler.hooks.done.tap("nitro:dev", (stats) => {
          ctx.servicesChanged ||= hasEmittedAssets(stats);
        });
      }
    }
    if (ctx.compiler) {
      ctx.devWatch?.attach(ctx.compiler);
    }
  });

  api.onBeforeStartDevServer(({ server }) => {
    const nitro = useNitro(ctx);
    const devServer = createDevServer(nitro) as NitroDevServer & DevApp;
    const handle = createNodeHandler(nitro, devServer);

    // The SSR renderer renders pages instead of the client HTML (served by Rsbuild otherwise)
    const ssr = !!(nitro.options.renderer?.handler || nitro.options.renderer?.template);
    server.middlewares.use((req: NitroDevRequest, res, next) => {
      if (isExplicitRoute(nitro, devServer, req) || (ssr && isPageRequest(req))) {
        return handle(req, res, next);
      }
      // An asset load that Rsbuild cannot serve must not be answered with a page by a catch-all
      req._nitroAssetCheck = isAssetRequest(req);
      next();
    });

    const hmrPath = api.getNormalizedConfig().dev.client.path;
    server.httpServer?.on("upgrade", (req: IncomingMessage, socket, head) => {
      if (req.url?.split("?", 1)[0] !== hmrPath) {
        devServer.upgrade(req, socket as any, head);
      }
    });

    return () => {
      server.middlewares.use(handle);
    };
  });

  api.onCloseDevServer(async () => {
    ctx.devWatch?.close();
    await useNitro(ctx).close();
  });
}

function createNodeHandler(nitro: Nitro, devServer: NitroDevServer) {
  return async (nodeReq: NitroDevRequest, nodeRes: ServerResponse, next: Next) => {
    const originalURL = nodeReq.url!;
    nodeReq.url = withBase(originalURL, nitro.options.baseURL || "/");
    try {
      const res = await devServer.fetch(new NodeRequest({ req: nodeReq, res: nodeRes }));
      if (nodeRes.writableEnded || nodeRes.headersSent) {
        return;
      }
      if (
        nodeReq._nitroAssetCheck &&
        res.ok &&
        /^text\/html\b/i.test(res.headers.get("content-type") || "")
      ) {
        await res.body?.cancel();
        nodeReq.url = originalURL;
        return next();
      }
      await sendNodeResponse(nodeRes, res);
    } catch (error) {
      next(error);
    } finally {
      nodeReq.url = originalURL;
    }
  };
}
