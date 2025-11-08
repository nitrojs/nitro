import type { NitroOptions } from "./config.ts";

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
}

export type {};
