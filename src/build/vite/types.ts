import type { OutputBundle } from "rollup";
import type { getViteRollupConfig } from "./rollup.ts";
import type { DevWorker, Nitro, NitroConfig, NitroModule } from "nitro/types";
import type { NitroDevApp } from "../../dev/app.ts";

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

declare module "rollup" {
  interface Plugin {
    nitro?: NitroModule;
  }
}

export interface NitroPluginConfig extends NitroConfig {
  /**
   * @internal Use preinitialized Nitro instance for the plugin.
   */
  _nitro?: Nitro;

  experimental?: NitroConfig["experimental"] & {
    vite: {
      /**
       * @experimental Use the virtual filesystem for intermediate environment build output files.
       * @note This is unsafe if plugins rely on temporary files on the filesystem.
       */
      virtualBundle?: boolean;

      /**
       * @experimental Enable `?assets` import proposed by https://github.com/vitejs/vite/discussions/20913
       * @default true
       */
      assetsImport?: boolean;

      /**
       * Reload the page when a server module is updated.
       *
       * @default true
       */
      serverReload: boolean;
    };
  };
}

export interface ServiceConfig {
  entry: string;
}

export interface NitroPluginContext {
  nitro?: Nitro;
  pluginConfig: NitroPluginConfig;
  rollupConfig?: ReturnType<typeof getViteRollupConfig>;
  devWorker?: DevWorker;
  devApp?: NitroDevApp;
  services: Record<string, ServiceConfig>;

  _isRolldown?: boolean;
  _initialized?: boolean;
  _publicDistDir?: string;
  _entryPoints: Record<string, string>;
  _serviceBundles: Record<string, OutputBundle>;
}
