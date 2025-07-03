import type { Nitro } from "nitro/types";
import type { DevEnvironmentContext, HotChannel, ResolvedConfig } from "vite";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DevEnvironment } from "vite";
import { createDevServer } from "../../dev/server";
import { pathToFileURL } from "node:url";
import { runtimeDir } from "nitro/runtime/meta";

// https://vite.dev/guide/api-environment-runtimes.html#modulerunner

export async function createNitroDevEnvironment(
  name: string,
  config: ResolvedConfig,
  nitro: Nitro
): Promise<NitroDevEnvironment> {
  const devServer = createDevServer(nitro);

  const listeners = new WeakMap();
  const transport: HotChannel = {
    send: (data) => devServer.sendMessage(data),
    on: (event: string, handler: any) => {
      if (event === "connection") return;
      const listener = (value: any) => {
        if (value.type === "custom" && value.event === event) {
          handler(value.data, {
            send: (payload: any) => devServer.sendMessage(payload),
          });
        }
      };
      listeners.set(handler, listener);
      devServer.onMessage(listener);
    },
    off: (event, handler) => {
      if (event === "connection") return;
      const listener = listeners.get(handler);
      if (listener) {
        devServer.offMessage(listener);
        listeners.delete(handler);
      }
    },
  };

  const context: DevEnvironmentContext = {
    hot: true,
    transport,
    options: {
      consumer: "server",
    },
  };

  const devEnv = new NitroDevEnvironment(
    name,
    config,
    context,
    nitro,
    devServer
  );

  // TODO: Signal dev server to directly use entry
  await writeFile(
    resolve(nitro.options.buildDir, "dev/index.mjs"),
    `await import("${pathToFileURL(resolve(runtimeDir, "internal/vite/dev-worker.mjs")).href}")`,
    "utf8"
  );
  await nitro.hooks.callHook("dev:reload");

  return devEnv;
}

export class NitroDevEnvironment extends DevEnvironment {
  nitro: Nitro;
  devServer: ReturnType<typeof createDevServer>;

  constructor(
    name: string,
    config: ResolvedConfig,
    context: DevEnvironmentContext,
    nitro: Nitro,
    devServer: ReturnType<typeof createDevServer>
  ) {
    super(name, config, context);
    this.nitro = nitro;
    this.devServer = devServer;
  }

  async dispatchFetch(request: Request): Promise<Response> {
    return this.devServer.app.fetch(request)
  }

  override async close() {
    await super.close();
    await this.devServer.close();
  }
}
