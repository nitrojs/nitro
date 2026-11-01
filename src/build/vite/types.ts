import type { TransformResult, Plugin as VitePlugin } from "vite";
import type { getBundlerConfig } from "./bundler.ts";
import type { Nitro, NitroConfig, NitroModule, ViteServiceConfig } from "nitro/types";
import type { RunnerManager } from "env-runner";
import type { NitroDevApp } from "../../dev/app.ts";

export type { ViteServiceConfig } from "nitro/types";

declare module "vite" {
  interface UserConfig {
    /**
     * Nitro Vite Plugin options.
     */
    nitro?: NitroConfig;
  }

  interface Plugin {
    nitro?: NitroModule;
  }
}

export interface NitroPluginConfig extends NitroConfig {
  /**
   * Existing Nitro instance to use instead of creating one (for frameworks that create Nitro themselves).
   */
  _nitro?: Nitro;
}

export interface NitroPluginContext {
  nitro?: Nitro;
  pluginConfig: NitroPluginConfig;
  bundlerConfig?: Awaited<ReturnType<typeof getBundlerConfig>>;
  devApp?: NitroDevApp;
  services: Record<string, ViteServiceConfig>;

  _isRolldown?: boolean;
  _isVitest?: boolean;
  _initialized?: boolean;
  _viteVersionChecked?: boolean;
  _envRunner?: RunnerManager;
  _closingEnvRunner?: boolean;
  _closePromise?: Promise<void>;
  _devErrorPageServed?: boolean;
  _initPromise?: Promise<RunnerManager>;
  _viteEnvs?: Map<string, string>;
  _transformRequest?: (id: string) => Promise<TransformResult | null | undefined>;
  _publicDistDir?: string;
  _entryPoints: Record<string, string>;
  _pluginModules?: VitePlugin[];
  _nitroEnvAliases?: string[];
}
