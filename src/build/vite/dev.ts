import type { NitroPluginContext } from "./plugin";
import type {
  DevEnvironmentContext,
  HotChannel,
  ResolvedConfig,
  ViteDevServer,
} from "vite";

import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { runtimeDir } from "nitro/runtime/meta";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { DevEnvironment } from "vite";
import { NitroDevServer } from "../../dev/server";

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

// ---- Nitro Dev Environment ----

export async function createNitroDevEnvironment(
  ctx: NitroPluginContext,
  name: string,
  config: ResolvedConfig
): Promise<FetchableDevEnvironment> {
  const nitroDev = new NitroDevServer(ctx.nitro!);
  return createFetchableDevEnvironment(name, config, {
    fetch: nitroDev.fetch.bind(nitroDev),
    onMessage: nitroDev.onMessage.bind(nitroDev),
    offMessage: nitroDev.offMessage.bind(nitroDev),
    sendMessage: nitroDev.sendMessage.bind(nitroDev),
    async init() {
      await ctx.nitro!.hooks.callHook("dev:reload", {
        entry: resolve(runtimeDir, "internal/vite/worker.mjs"),
        workerData: {
          viteEntry: ctx.nitro!.options.entry,
        },
      });
    },
  });
}

// ---- Vite Dev Server Integration ----

export function configureViteDevServer(
  ctx: NitroPluginContext,
  server: ViteDevServer
) {
  // Expose an RPC server to environments
  const rpcServer = createServer((req, res) => {
    server.middlewares.handle(req, res, () => {});
  });
  rpcServer.listen(getSocketAddress(), () => {
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

  // Create a sorted array of routable services
  const routableServices = Object.entries(ctx.pluginConfig.services || {})
    .filter(([, service]) => service.path)
    .map(([name, service]) => {
      return {
        path: service.path!,
        env: server.environments[name] as FetchableDevEnvironment,
      };
    })
    .sort((a, b) => b.path.length - a.path.length);

  server.middlewares.use(async (nodeReq, nodeRes, next) => {
    // Fast Skip known prefixes
    if (
      nodeReq.url!.startsWith("/@vite/") ||
      nodeReq.url!.startsWith("/@fs/") ||
      nodeReq.url!.startsWith("/@id/")
    ) {
      return next();
    }

    // Match fetchable environment based on request
    // 1. Check for x-vite-env header
    // 2. Check if the request URL starts with a routable service path
    // 3. Default to nitro environment
    const envHeader = nodeReq.headers["x-vite-env"] as string;
    const env = (server.environments[envHeader] ||
      routableServices.find((s) => nodeReq.url!.startsWith(s.path))?.env ||
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
  });
}

function getSocketAddress() {
  const socketName = `nitro-vite-${process.pid}-${Math.round(Math.random() * 10_000)}.sock`;
  // Windows: pipe
  if (process.platform === "win32") {
    return join(String.raw`\\.\pipe`, socketName);
  }
  // Linux: abstract namespace
  if (process.platform === "linux") {
    const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
    if (nodeMajor >= 20) {
      return `\0${socketName}`;
    }
  }
  // Unix socket
  return join(tmpdir(), socketName);
}
