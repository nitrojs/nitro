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
  devServer: DevServer
): FetchableDevEnvironment {
  const transport = createTransport(devServer);
  const context: DevEnvironmentContext = { hot: true, transport };
  return new FetchableDevEnvironment(name, config, context, devServer);
}

export class FetchableDevEnvironment extends DevEnvironment {
  devServer: DevServer;

  constructor(
    name: string,
    config: ResolvedConfig,
    context: DevEnvironmentContext,
    devServer: DevServer
  ) {
    super(name, config, context);
    this.devServer = devServer;
  }

  async dispatchFetch(request: Request): Promise<Response> {
    return this.devServer.fetch(request);
  }

  override async init(...args: any[]): Promise<void> {
    await this.devServer.init?.();
    return super.init(...args);
  }
}

function createTransport(hooks: TransportHooks): HotChannel {
  const listeners = new WeakMap();
  return {
    send: (data) => hooks.sendMessage(data),
    on: (event: string, handler: any) => {
      if (event === "connection") return;
      const listener = (value: any) => {
        if (value.type === "custom" && value.event === event) {
          handler(value.data, {
            send: (payload: any) => hooks.sendMessage(payload),
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
        event: "nitro-rpc",
        data:
          typeof addr === "string"
            ? { socketPath: addr }
            : // prettier-ignore
              { host: `${addr.address.includes(":")? `[${addr.address}]`: addr.address}:${addr.port}`, },
      });
    }
  });

  const getEnvFetch = (
    envName: string
  ): FetchableDevEnvironment["dispatchFetch"] => {
    const env = server.environments[envName] as FetchableDevEnvironment;
    if (env && typeof env.dispatchFetch !== "function") {
      ctx.nitro!.logger.warn("Environment is not fetchable:", env.name);
    }
    return env?.dispatchFetch;
  };

  const nitroEnvMiddleware = async (
    nodeReq: IncomingMessage,
    nodeRes: ServerResponse,
    next: () => void
  ) => {
    if (/^\/@(?:vite|fs|id)\//.test(nodeReq.url!)) {
      return next();
    }

    // Match fetchable environment based on request
    // 1. Check for x-vite-env header
    // 3. Default to nitro environment
    const env = (server.environments[nodeReq.headers["x-vite-env"] as string] ||
      server.environments.nitro) as FetchableDevEnvironment;

    // Make sure the environment is fetchable or else skip
    if (typeof env?.dispatchFetch !== "function") {
      ctx.nitro!.logger.warn("Environment is not fetchable:", env.name);
      return next();
    }

    // Dispatch the request to the environment
    const webReq = new NodeRequest({ req: nodeReq, res: nodeRes });
    const webRes = await env.dispatchFetch(webReq);
    return webRes.status === 404
      ? next()
      : await sendNodeResponse(nodeRes, webRes);
  };

  return () => {
    const transformIndex = server.middlewares.stack.findIndex(
      (m) => (m.handle as { name: string }).name === "viteTransformMiddleware"
    );
    server.middlewares.stack.splice(transformIndex, 0, {
      route: "",
      handle: nitroEnvMiddleware,
    });
  };
}
