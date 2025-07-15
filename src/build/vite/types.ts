import type { OutputChunk } from "rollup";
import type { getViteRollupConfig } from "./rollup";
import type { Nitro, NitroConfig } from "nitro/types";

export interface NitroPluginConfig {
  /** Custom Nitro config */
  config?: NitroConfig;

  /**
   * Fetchable service environments automatically created by the plugin.
   *
   * **Note:** You can use top level `environments` with same keys to extend environment configurations.
   */
  services?: Record<string, ServiceConfig>;
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

  _manifest?: Record<string, any>;
  _publicDistDir?: string;
  _buildResults?: Record<string, OutputChunk>;
}
