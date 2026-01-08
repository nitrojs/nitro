import type { NitroOptions } from "./config.ts";

export interface NitroImportMeta {
  dev?: boolean;
  preset?: NitroOptions["preset"];
  prerender?: boolean;
  nitro?: boolean;
  server?: boolean;
  client?: boolean;
  baseURL?: string;
  runtimeConfig?: Record<string, any>;
  _asyncContext?: boolean;
  _tasks?: boolean;
}

declare global {
  interface ImportMeta extends NitroImportMeta {}
}

// eslint-disable-next-line unicorn/require-module-specifiers
export type {};
