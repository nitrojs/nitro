import type { NitroPluginContext } from "./types";
import type {
  DevEnvironmentContext,
  HotChannel,
  ResolvedConfig,
  ViteDevServer,
} from "vite";

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { getSocketAddress, isSocketSupported } from "get-port-please";
import { DevEnvironment } from "vite";

// https://vite.dev/guide/api-environment-runtimes.html#modulerunner

// ---- Types ----

export type FetchHandler = (req: Request) => Promise<Response>;

export interface TransportHooks {
  sendMessage: (data: any) => void;
  onMessage: (listener: (value: any) => void) => void;
  offMessage: (listener: (value: any) => void) => void;
}

export interface DevServer extends TransportHooks {
  fetch: FetchHandler;
  init?: () => void | Promise<void>;
}

// ---- Fetchable Dev Environment ----

export function createFetchableDevEnvironment(
  name: string,
  config: ResolvedConfig,
  devServer: DevServer,
  entry: string
): FetchableDevEnvironment {
  const transport = createTransport(name, devServer);
  const context: DevEnvironmentContext = { hot: true, transport };
  return new FetchableDevEnvironment(name, config, context, devServer, entry);
}

export class FetchableDevEnvironment extends DevEnvironment {
  devServer: DevServer;

  constructor(
    name: string,
    config: ResolvedConfig,
    context: DevEnvironmentContext,
    devServer: DevServer,
    entry: string
  ) {
    super(name, config, context);
    this.devServer = devServer;

    this.devServer.sendMessage({
      type: "custom",
      event: "nitro:vite-env",
      data: { name, entry },
    });
  }

  async dispatchFetch(request: Request): Promise<Response> {
    return this.devServer.fetch(request);
  }

  override async init(...args: any[]): Promise<void> {
    await this.devServer.init?.();
    return super.init(...args);
  }
}

function createTransport(name: string, hooks: TransportHooks): HotChannel {
  const listeners = new WeakMap();
  return {
    send: (data) => hooks.sendMessage({ ...data, viteEnv: name }),
    on: (event: string, handler: any) => {
      if (event === "connection") return;
      const listener = (value: any) => {
        if (
          value?.type === "custom" &&
          value.event === event &&
          value.viteEnv === name
        ) {
          handler(value.data, {
            send: (payload: any) =>
              hooks.sendMessage({ ...payload, viteEnv: name }),
          });
        }
      };
      listeners.set(handler, listener);
      hooks.onMessage(listener);
    },
    off: (event, handler) => {
      if (event === "connection") return;
      const listener = listeners.get(handler);
      if (listener) {
        hooks.offMessage(listener);
        listeners.delete(handler);
      }
    },
  };
}

// ---- Vite Dev Server Integration ----

export async function configureViteDevServer(
  ctx: NitroPluginContext,
  server: ViteDevServer
) {
  // Restart with nitro.config changes
  const nitroConfigFile = ctx.nitro!.options._c12.configFile;
  if (nitroConfigFile) {
    server.config.configFileDependencies.push(nitroConfigFile);
  }

  // Expose an RPC server to environments
  const rpcServer = createServer((req, res) => {
    server.middlewares.handle(req, res, () => {});
  });
  const listenAddr = (await isSocketSupported())
    ? getSocketAddress({ name: "nitro-vite", pid: true, random: true })
    : { port: 0, host: "localhost" };
  rpcServer.listen(listenAddr, () => {
    const addr = rpcServer.address()!;
    for (const env of Object.values(server.environments)) {
      env.hot.send({
        type: "custom",
        event: "nitro:vite-server-addr",
        data:
          typeof addr === "string"
            ? { socketPath: addr }
            : // prettier-ignore
              { host: `${addr.address.includes(":")? `[${addr.address}]`: addr.address}:${addr.port}`, },
      });
    }
  });

  const nitroEnvMiddleware = async (
    nodeReq: IncomingMessage,
    nodeRes: ServerResponse,
    next: () => void
  ) => {
    if (/^\/@(?:vite|fs|id)\//.test(nodeReq.url!)) {
      return next();
    }

    // Dispatch the request to the nitro environment
    const env = server.environments.nitro as FetchableDevEnvironment;
    const webReq = new NodeRequest({ req: nodeReq, res: nodeRes });
    const webRes = await env.dispatchFetch(webReq);
    return webRes.status === 404
      ? next()
      : await sendNodeResponse(nodeRes, webRes);
  };

  // 1. Handle as first middleware for HTML requests
  server.middlewares.use((req, res, next) => {
    // https://github.com/vitejs/vite/issues/20705#issuecomment-3272974173
    if (!res.getHeader("vary")) {
      res.setHeader("vary", "Sec-Fetch-Dest, Accept");
    }
    if (isHTMLRequest(req)) {
      nitroEnvMiddleware(req, res, next);
    } else {
      next();
    }
  });
  return () => {
    // 2. Handle as last middleware for non-HTML requests
    server.middlewares.use((req, res, next) => {
      if (isHTMLRequest(req)) {
        next();
      } else {
        nitroEnvMiddleware(req, res, next);
      }
    });
  };
}

function isHTMLRequest(req: IncomingMessage): boolean {
  if ((req as any)._isHTML !== undefined) {
    return (req as any)._isHTML;
  }
  let isHTML = false;
  const fetchDest = req.headers["sec-fetch-dest"];
  if (fetchDest) {
    isHTML = /^(document|iframe|frame)$/.test(fetchDest);
  } else {
    const accept = req.headers.accept;
    isHTML = !!/text\/html/.test(accept || "");
  }
  (req as any)._isHTML = isHTML;
  return isHTML;
}
