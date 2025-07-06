import type { Nitro } from "nitro/types";
import type { DevEnvironmentContext, HotChannel, ResolvedConfig } from "vite";
import { DevEnvironment } from "vite";
import { NitroDevServer } from "../../dev/server";
import { resolve } from "node:path";
import { runtimeDir } from "nitro/runtime/meta";

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
  name: string,
  config: ResolvedConfig,
  nitro: Nitro
): Promise<FetchableDevEnvironment> {
  const nitroDev = new NitroDevServer(nitro);
  return createFetchableDevEnvironment(name, config, {
    fetch: nitroDev.fetch.bind(nitroDev),
    onMessage: nitroDev.onMessage.bind(nitroDev),
    offMessage: nitroDev.offMessage.bind(nitroDev),
    sendMessage: nitroDev.sendMessage.bind(nitroDev),
    async init() {
      await nitro.hooks.callHook("dev:reload", {
        entry: resolve(runtimeDir, "internal/vite/worker.mjs"),
        workerData: {
          viteEntry: nitro.options.entry,
        },
      });
    },
  });
}
