import type { Nitro } from "nitropack/types";
import type { ServerResponse } from "node:http";

import { resolveModulePath } from "exsolve";
import { defineLazyEventHandler, fromNodeMiddleware } from "h3";

export async function netlifyDev(nitro: Nitro) {
  // If we're already running inside the Netlify CLI, there is no need to run
  // the plugin, as the environment will already be configured.
  // TODO: We should run module anyway when emulation moved to runtime context.
  if (!nitro.options.dev || process.env.NETLIFY_DEV) {
    return;
  }

  const netlifyDevEntry = resolveModulePath("@netlify/dev", {
    from: nitro.options.nodeModulesDirs,
    try: true,
  });

  if (!netlifyDevEntry) {
    nitro.logger.warn(
      "Netlify local emulator is not installed. Please install it using `npx nypm i @netlify/dev` to enable dev emulation."
    );
    return;
  }

  const { NetlifyDev } = (await import(
    netlifyDevEntry
  )) as typeof import("@netlify/dev");

  const logger = nitro.logger.withTag("netlify");

  const netlifyDev = new NetlifyDev({
    ...nitro.options.netlify?.dev,
    logger,
    projectRoot: nitro.options.rootDir,
    staticFiles: {
      ...nitro.options.netlify?.dev?.staticFiles,
      directories: nitro.options.publicAssets.map((d) => d.dir),
    },
  });

  await netlifyDev.start();

  nitro.hooks.hook("close", async () => {
    await netlifyDev.stop();
  });

  if (!netlifyDev.siteIsLinked) {
    logger.log(
      `💭 Linking this project to a Netlify site lets you deploy your site, use any environment variables defined on your team and site and much more. Run \`npx netlify init\` to get started.`
    );
  }

  nitro.options.devHandlers ??= [];
  nitro.options.devHandlers.push({
    handler: defineLazyEventHandler(() => {
      // logger.log(
      //   `Middleware loaded. Emulating features: ${netlifyDev.getEnabledFeatures().join(", ")}.`
      // );
      return fromNodeMiddleware(
        async function netlifyPreMiddleware(nodeReq, nodeRes, next) {
          if (!netlifyDev) {
            return;
          }
          const headers: Record<string, string> = {};
          const result = await netlifyDev.handleAndIntrospectNodeRequest(
            nodeReq,
            {
              headersCollector: (key, value) => {
                headers[key] = value;
              },
              serverAddress: `http://localhost:${nodeReq.socket.localPort}`,
            }
          );
          const isStaticFile = result?.type === "static";
          // Don't serve static matches. Let the Nitro server handle them.
          if (result && !isStaticFile) {
            fromWebResponse(result.response, nodeRes);
            return;
          }
          for (const key in headers) {
            nodeRes.setHeader(key, headers[key] ?? "");
          }
          next();
        }
      );
    }),
  });
}

async function fromWebResponse(webRes: Response, res: ServerResponse) {
  res.statusCode = webRes.status;
  for (const [name, value] of webRes.headers.entries()) {
    res.setHeader(name, value);
  }
  if (webRes.body) {
    const reader = webRes.body.getReader();
    const writer = res;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      writer.write(value);
    }
  }
  res.end();
}
