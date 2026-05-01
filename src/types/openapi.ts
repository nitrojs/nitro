// import type { ApiReferenceConfiguration as ScalarConfig } from "@scalar/api-reference";

/**
 * Swagger UI configuration options.
 *
 * @see https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/
 */
export interface SwaggerUIConfig {
  deepLinking?: boolean;
  displayOperationId?: boolean;
  defaultModelsExpandDepth?: number;
  defaultModelExpandDepth?: number;
  defaultModelRendering?: "example" | "model";
  displayRequestDuration?: boolean;
  docExpansion?: "list" | "full" | "none";
  filter?: boolean | string;
  persistAuthorization?: boolean;
  requestSnippetsEnabled?: boolean;
  showExtensions?: boolean;
  showCommonExtensions?: boolean;
  /** Only "alpha" is supported (function values are not JSON-serializable). */
  tagsSorter?: "alpha";
  /**
   * Note: function callbacks cannot be passed via Nitro configuration (not JSON-serializable).
   */
  onComplete?: never;
  layout?: string;
  configUrl?: string;
  oauth2RedirectUrl?: string;
  withCredentials?: boolean;
  [key: string]: unknown;
}

/**
 * Nitro OpenAPI configuration.
 *
 * @see https://nitro.build/config#openapi
 * @see https://nitro.build/docs/openapi
 */
export interface NitroOpenAPIConfig {
  /**
   * OpenAPI document metadata.
   */
  meta?: {
    title?: string;
    description?: string;
    version?: string;
  };

  /**
   * Route for the OpenAPI JSON endpoint.
   *
   * @default "/_openapi.json"
   */
  route?: string;

  /**
   * Enable OpenAPI generation for production builds.
   *
   * - `"runtime"` — generate at runtime (allows middleware usage).
   * - `"prerender"` — prerender the JSON response at build time (most efficient).
   * - `false` — disable in production.
   *
   * @see https://nitro.build/config#openapi
   */
  production?: false | "runtime" | "prerender";

  /**
   * UI configurations for interactive API documentation.
   */
  ui?: {
    /**
     * Scalar UI configuration.
     *
     * Set to `false` to disable.
     */
    scalar?:
      | false
      | (Partial<unknown> & {
          /**
           * Route for Scalar UI.
           *
           * @default "/_scalar"
           */
          route?: string;
        });
    /**
     * Swagger UI configuration.
     *
     * Set to `false` to disable.
     *
     * @see https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/
     */
    swagger?:
      | false
      | (SwaggerUIConfig & {
          /**
           * Route for Swagger UI.
           *
           * @default "/_swagger"
           */
          route?: string;
        });
  };
}
