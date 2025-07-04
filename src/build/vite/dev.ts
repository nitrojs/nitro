import type { Nitro } from "nitro/types";
import type { DevEnvironmentContext, HotChannel, ResolvedConfig } from "vite";
import { resolve } from "node:path";
import { DevEnvironment } from "vite";
import { createDevServer } from "../../dev/server";
import { runtimeDir } from "nitro/runtime/meta";

// https://vite.dev/guide/api-environment-runtimes.html#modulerunner

// ---- Fetchable Dev Environment ----

export type FetchHandler = (req: Request) => Promise<Response>;

export class FetchableDevEnvironment extends DevEnvironment {
  _fetch: FetchHandler;

  constructor(
    name: string,
    config: ResolvedConfig,
    context: DevEnvironmentContext,
    fetch: FetchHandler
  ) {
    super(name, config, context);
    this._fetch = fetch;
  }

  async dispatchFetch(request: Request): Promise<Response> {
    return this._fetch(request);
  }
}

function createTransport(hooks: {
  sendMessage: (data: any) => void;
  onMessage: (listener: (value: any) => void) => void;
  offMessage: (listener: (value: any) => void) => void;
}): HotChannel {
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
): Promise<NitroDevEnvironment> {
  const devServer = createDevServer(nitro);
  const transport = createTransport({
    sendMessage: devServer.sendMessage,
    onMessage: devServer.onMessage,
    offMessage: devServer.offMessage,
  });
  const context: DevEnvironmentContext = { hot: true, transport };
  return new NitroDevEnvironment(name, config, context, nitro, devServer);
}

export class NitroDevEnvironment extends FetchableDevEnvironment {
  nitro: Nitro;
  devServer: ReturnType<typeof createDevServer>;

  constructor(
    name: string,
    config: ResolvedConfig,
    context: DevEnvironmentContext,
    nitro: Nitro,
    devServer: ReturnType<typeof createDevServer>
  ) {
    super(name, config, context, devServer.app.fetch);
    this.nitro = nitro;
    this.devServer = devServer;
  }

  override async init(...args: any[]): Promise<void> {
    await this.nitro.hooks.callHook("dev:reload", {
      entry: resolve(runtimeDir, "internal/vite/dev-worker.mjs"),
    });
    return super.init(...args);
  }

  override async close() {
    await super.close();
    await this.devServer.close();
  }
}
