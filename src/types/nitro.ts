import type { ConsolaInstance } from "consola";
import type { HTTPMethod } from "h3";
import type { Hookable } from "hookable";
import type { PresetName, PresetOptions } from "../presets/index.ts";
import type { Unimport } from "unimport";
import type { NitroConfig, NitroOptions } from "./config.ts";
import type { NitroEventHandler } from "./handler.ts";
import type { NitroHooks } from "./hooks.ts";
import type { PrerenderRoute } from "./prerender.ts";
import type { TSConfig } from "pkg-types";
import type { Router } from "../routing.ts";
import type { NitroRouteRules } from "./route-rules.ts";
import type { WorkerAddress } from "./runner.ts";

type MaybeArray<T> = T | T[];

/** Nitro package metadata including version information. */
export interface NitroMeta {
  version: string;
  majorVersion: number;
}

/**
 * The core Nitro instance available throughout the build lifecycle.
 *
 * Provides access to resolved options, hooks, the virtual file system,
 * scanned handlers, and utility methods.
 */
export interface Nitro {
  meta: NitroMeta;
  options: NitroOptions;
  scannedHandlers: NitroEventHandler[];
  vfs: Map<string, { render: () => string | Promise<string> }>;
  hooks: Hookable<NitroHooks>;
  unimport?: Unimport;
  logger: ConsolaInstance;
  fetch: (input: Request) => Response | Promise<Response>;
  close: () => Promise<void>;
  updateConfig: (config: NitroDynamicConfig) => void | Promise<void>;
  routing: Readonly<{
    sync: () => void;
    routeRules: Router<NitroRouteRules & { _route: string }>;
    routes: Router<MaybeArray<NitroEventHandler & { _importHash: string }>>;
    globalMiddleware: (NitroEventHandler & { _importHash: string })[];
    routedMiddleware: Router<NitroEventHandler & { _importHash: string }>;
  }>;

  /* @internal */
  _prerenderedRoutes?: PrerenderRoute[];
  _prerenderMeta?: Record<string, { contentType?: string }>;
}

/**
 * Subset of {@link NitroConfig} that can be updated at runtime via
 * `nitro.updateConfig()`.
 */
export type NitroDynamicConfig = Pick<NitroConfig, "runtimeConfig" | "routeRules">;

export type NitroTypes = {
  routes: Record<string, Partial<Record<HTTPMethod | "default", string[]>>>;
  tsConfig?: TSConfig;
};

/**
 * Metadata about the framework using Nitro.
 *
 * @see https://nitro.build/config#framework
 */
export interface NitroFrameworkInfo {
  name?: "nitro" | (string & {});
  version?: string;
}

/**
 * Build info written to `<output.dir>/nitro.json` (production, default
 * `.output/nitro.json`) or `<rootDir>/node_modules/.nitro/nitro.dev.json`
 * (development).
 *
 * Contains preset, framework, version, and command information.
 */
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
  serverEntry?: string;
  publicDir?: string;
  dev?: {
    pid: number;
    workerAddress?: WorkerAddress;
  };
  config?: Partial<PresetOptions>;
}
