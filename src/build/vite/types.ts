import type { getViteRollupConfig } from "./bundler.ts";
import type { EnvRunner, Nitro, NitroConfig, NitroModule } from "nitro/types";
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

export interface NitroPluginConfig extends NitroConfig {
  /**
   * @internal Use preinitialized Nitro instance for the plugin.
   */
  _nitro?: Nitro;

  experimental?: NitroConfig["experimental"] & {
    vite: {
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
      serverReload?: boolean;

      /**
       * Additional Vite environment services to register.
       */
      services?: Record<string, ServiceConfig>;
    };
  };
}

export interface ServiceConfig {
  entry: string;
}

export interface NitroPluginContext {
  nitro?: Nitro;
  pluginConfig: NitroPluginConfig;
  rollupConfig?: Awaited<ReturnType<typeof getViteRollupConfig>>;
  devApp?: NitroDevApp;
  services: Record<string, ServiceConfig>;

  _isRolldown?: boolean;
  _initialized?: boolean;
  _envRunner?: EnvRunner;
  _publicDistDir?: string;
  _entryPoints: Record<string, string>;
}
