import type { H3Event } from "h3";
import type { NitroConfig, NitroOptions, NitroRuntimeConfig } from "./config";
import type { NitroModule } from "./module";

export interface NitroStaticBuildFlags {
  _asyncContext?: boolean;
  _websocket?: boolean;
  _tasks?: boolean;
  dev?: boolean;
  client?: boolean;
  nitro?: boolean;
  baseURL?: string;
  prerender?: boolean;
  preset?: NitroOptions["preset"];
  server?: boolean;
  versions?: {
    nitro?: string;
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process extends NitroStaticBuildFlags {}
  }

  interface ImportMeta extends NitroStaticBuildFlags {}

    // eslint-disable-next-line no-var
  var __nitro__: {
    useRuntimeConfig?: <T extends NitroRuntimeConfig = NitroRuntimeConfig>(
      event?: H3Event
    ) => T;
    [key: string]: any;
  };
}

declare global {
  const defineNitroConfig: (config: NitroConfig) => NitroConfig;
  const defineNitroModule: (definition: NitroModule) => NitroModule;
}

export type {};
