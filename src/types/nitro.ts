import type { ConsolaInstance } from "consola";
import type { RouterMethod } from "h3";
import type { Hookable } from "hookable";
import type { PresetName, PresetOptions } from "nitropack/presets";
import type { Unimport } from "unimport";
import type { Storage } from "unstorage";
import type { NitroConfig, NitroOptions } from "./config";
import type { NitroEventHandler } from "./handler";
import type { NitroHooks } from "./hooks";
import type { PrerenderRoute } from "./prerender";
import type { TSConfig } from "pkg-types";

export interface Nitro {
  options: NitroOptions;
  scannedHandlers: NitroEventHandler[];
  vfs: Record<string, string>;
  hooks: Hookable<NitroHooks>;
  unimport?: Unimport;
  logger: ConsolaInstance;
  storage: Storage;
  close: () => Promise<void>;
  updateConfig: (config: NitroDynamicConfig) => void | Promise<void>;

  /* @internal */
  _prerenderedRoutes?: PrerenderRoute[];
  _prerenderMeta?: Record<string, { contentType?: string }>;
}

export type NitroDynamicConfig = Pick<
  NitroConfig,
  "runtimeConfig" | "routeRules"
>;

export type NitroTypes = {
  routes: Record<string, Partial<Record<RouterMethod | "default", string[]>>>;
  tsConfig?: TSConfig;
};

export interface NitroFrameworkInfo {
  name?: "nitro" | (string & {});
  version?: string;
}

/** Build info written to `.output/nitro.json` or `.nitro/dev/nitro.json` */
export interface NitroBuildInfo {
  date: string;
  preset: PresetName;
  framework: NitroFrameworkInfo;
  versions: {
    nitro: string;
    [key: string]: string;
  };
  commands?: {
    preview?: string;
    deploy?: string;
  };
  dev?: {
    pid: number;
    workerAddress?: { host: string; port: number; socketPath?: string };
  };
  config?: Partial<PresetOptions>;
}
