// import type { ApiReferenceConfiguration as ScalarConfig } from "@scalar/api-reference";

/**
 * Swagger UI configuration options
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
 * Nitro OpenAPI configuration
 *
 * @see https://nitro.build/docs/openapi
 */
export interface NitroOpenAPIConfig {
  /**
   * OpenAPI meta information
   */
  meta?: {
    title?: string;
    description?: string;
    version?: string;
  };

  /**
   * OpenAPI json route
   *
   * Default is `/_openapi.json`
   */
  route?: string;

  /**
   * Enable OpenAPI generation for production builds
   */
  production?: false | "runtime" | "prerender";

  /**
   * UI configurations
   */
  ui?: {
    /**
     * Scalar UI configuration
     */
    scalar?:
      | false
      | (Partial<unknown> & {
          /**
           * Scalar UI route
           *
           * Default is `/_scalar`
           */
          route?: string;
        });
    /**
     * Swagger UI configuration
     *
     * @see https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/
     */
    swagger?:
      | false
      | (SwaggerUIConfig & {
          /**
           * Swagger UI route
           *
           * Default is `/_swagger`
           */
          route?: string;
        });
  };
}
