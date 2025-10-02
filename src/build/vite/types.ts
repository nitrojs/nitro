import type { OutputBundle } from "rollup";
import type { getViteRollupConfig } from "./rollup";
import type { DevWorker, Nitro, NitroConfig } from "nitro/types";

export interface NitroPluginConfig {
  /** Custom Nitro config */
  config?: NitroConfig;

  /**
   * Fetchable service environments automatically created by the plugin.
   *
   * **Note:** You can use top level `environments` with same keys to extend environment configurations.
   */
  services?: Record<string, ServiceConfig>;

  /**
   * @internal Pre-initialized Nitro instance.
   */
  _nitro?: Nitro;

  experimental?: {
    /**
     * @experimental Use the virtual filesystem for intermediate environment build output files.
     * @note This is unsafe if plugins rely on temporary files on the filesystem.
     */
    virtualBundle?: boolean;
  };
}

export interface ServiceConfig {
  /**
   * Path to the service entrypoint file.
   *
   * Services should export a web standard fetch handler function.
   *
   * Example:
   * ```ts
   * export default async (req: Request) => {
   *   return Response.json({ message: "Hello from service!" });
   * };
   * ```
   */
  entry: string;

  /**
   * Service route.
   *
   * - If `route` is not set, services are only accessible via `fetch("<url>", { viteEnv: "<name>" })`.
   * - `ssr` service is special and defaults to `"/**"` route, meaning it will handle all requests.
   */
  route?: string;
}

/**
 * @internal
 */
export interface NitroPluginContext {
  nitro?: Nitro;
  pluginConfig: NitroPluginConfig;
  rollupConfig?: ReturnType<typeof getViteRollupConfig>;
  devWorker?: DevWorker;

  _manifest: Record<string, { file: string }>;
  _publicDistDir?: string;
  _entryPoints: Record<string, string>;
  _serviceBundles: Record<string, OutputBundle>;
}
