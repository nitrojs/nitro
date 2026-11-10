import type { Compiler } from "@rspack/core";
import type { Nitro } from "nitro/types";
import type { DevWatch } from "../rspack/dev.ts";
import type { RollupPluginsHost } from "../rspack/_plugin.ts";
import type { RsbuildService } from "./_services.ts";
import type { ClientAssets } from "./_assets.ts";

export interface NitroRsbuildContext {
  dev: boolean;
  nitro?: Nitro;
  /**
   * Names of the client (`web`) environments, built before the server. The first one owns pages
   * (`client`, then `web`, then the first defined).
   */
  clientEnvs: string[];
  /** Output entries of the services (server environments, e.g. `ssr`). */
  services?: Record<string, RsbuildService>;
  /**
   * Whether pages are rendered from the client HTML (compiled into the renderer template, with the
   * SSR outlet rendered by the `ssr` service).
   */
  pageTemplate?: boolean;
  /** Client HTML of the page client environment (with `pageTemplate`). */
  pageHTML?: string;
  /** Compiler of the `nitro` environment. */
  compiler?: Compiler;
  /** Compilers of the client and service environments. */
  compilers?: Compiler[];
  /** Watch of the server build (dev, and `rsbuild build --watch` after the first build). */
  devWatch?: DevWatch;
  /** Plugins host of the `nitro` environment (virtual modules). */
  pluginsHost?: RollupPluginsHost;
  /** Assets of the client environments (`?assets` imports). */
  clientAssets?: ClientAssets;
  /** Nitro runtime modules imported by services (shared with them in development). */
  runtimeIds: Set<string>;
  /** Whether a service output changed since the last server reload (dev). */
  servicesChanged?: boolean;
}

export function useNitro(ctx: NitroRsbuildContext): Nitro {
  if (!ctx.nitro) {
    throw new Error("Nitro is not initialized yet.");
  }
  return ctx.nitro;
}
