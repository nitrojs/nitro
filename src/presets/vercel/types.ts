import type { send } from "@vercel/queue";

/**
 * Vercel Build Output Configuration
 * @see https://vercel.com/docs/build-output-api/v3
 */
export interface VercelBuildConfigV3 {
  version: 3;
  routes?: (
    | {
        src: string;
        dest?: string;
        headers?: Record<string, string>;
        continue?: boolean;
        status?: number;
      }
    | {
        handle: string;
      }
  )[];
  images?: {
    sizes: number[];
    domains: string[];
    remotePatterns?: {
      protocol?: "http" | "https";
      hostname: string;
      port?: string;
      pathname?: string;
    }[];
    minimumCacheTTL?: number;
    formats?: ("image/avif" | "image/webp")[];
    dangerouslyAllowSVG?: boolean;
    contentSecurityPolicy?: string;
  };
  wildcard?: Array<{
    domain: string;
    value: string;
  }>;
  overrides?: Record<
    string,
    {
      path?: string;
      contentType?: string;
    }
  >;
  cache?: string[];
  bypassToken?: string;
  framework?: {
    version: string;
  };
  crons?: {
    path: string;
    schedule: string;
  }[];
}

/**
 * https://vercel.com/docs/build-output-api/primitives#serverless-function-configuration
 * https://vercel.com/docs/build-output-api/primitives#node.js-config
 */
export interface VercelServerlessFunctionConfig {
  /**
   * Amount of memory (RAM in MB) that will be allocated to the Serverless Function.
   */
  memory?: number;

  /**
   * Specifies the instruction set "architecture" the Vercel Function supports.
   *
   * Either `x86_64` or `arm64`. The default value is `x86_64`
   */
  architecture?: "x86_64" | "arm64";

  /**
   * Maximum execution duration (in seconds) that will be allowed for the Serverless Function. `max` automatically sets the duration to the maximum allowed value.
   */
  maxDuration?: number | "max";

  /**
   * Map of additional environment variables that will be available to the Vercel Function,
   * in addition to the env vars specified in the Project Settings.
   */
  environment?: Record<string, string>;

  /**
   * List of Vercel Regions where the Vercel Function will be deployed to.
   */
  regions?: string[];

  /**
   * True if a custom runtime has support for Lambda runtime wrappers.
   */
  supportsWrapper?: boolean;

  /**
   * When true, the Serverless Function will stream the response to the client.
   */
  supportsResponseStreaming?: boolean;

  /**
   * Enables source map generation.
   */
  shouldAddSourcemapSupport?: boolean;

  /**
   * The runtime to use. Defaults to the auto-detected Node.js version.
   */
  runtime?: "nodejs20.x" | "nodejs22.x" | "bun1.x" | (string & {});

  /**
   * Experimental trigger configuration (e.g., Vercel Queues).
   */
  experimentalTriggers?: VercelFunctionTrigger[];

  [key: string]: unknown;
}

export type VercelFunctionTrigger = {
  type: "queue/v2beta";
  topic: string;
  retryAfterSeconds?: number;
  initialDelaySeconds?: number;
  consumer?: string;
};

export interface VercelOptions {
  config?: VercelBuildConfigV3;

  /**
   * If you have enabled skew protection in the Vercel dashboard, it will
   * be enabled by default.
   *
   * You can disable the Nitro integration by setting this option to `false`.
   */
  skewProtection?: boolean;

  /**
   * If you are using `vercel-edge`, you can specify the region(s) for your edge function.
   * @see https://vercel.com/docs/concepts/functions/edge-functions#edge-function-regions
   */
  regions?: string[];

  functions?: VercelServerlessFunctionConfig;

  /**
   * Handler format to use for Vercel Serverless Functions.
   *
   * Using `node` format enables compatibility with Node.js specific APIs in your Nitro application (e.g., `req.runtime.node`).
   *
   * Possible values are: `web` (default) and `node`.
   */
  entryFormat?: "web" | "node";

  /**
   * The route path for the Vercel cron handler endpoint.
   *
   * When `experimental.tasks` and `scheduledTasks` are configured,
   * Nitro registers a cron handler at this path that Vercel invokes
   * on each scheduled cron trigger.
   *
   * @default "/_vercel/cron"
   * @see https://vercel.com/docs/cron-jobs
   */
  cronHandlerRoute?: string;

  /**
   * Vercel Queues configuration.
   *
   * Messages are delivered via the `vercel:queue` runtime hook.
   *
   * @example
   * ```ts
   * // nitro.config.ts
   * export default defineNitroConfig({
   *   vercel: {
   *     queues: {
   *       triggers: [{ topic: "orders" }],
   *     },
   *   },
   * });
   * ```
   *
   * ```ts
   * // server/plugins/queues.ts
   * export default defineNitroPlugin((nitro) => {
   *   nitro.hooks.hook("vercel:queue", ({ message, metadata }) => {
   *     console.log(`Received message on ${metadata.topicName}:`, message);
   *   });
   * });
   * ```
   *
   * @see https://vercel.com/docs/queues
   */
  queues?: {
    /**
     * Route path for the queue consumer handler.
     * @default "/_vercel/queues/consumer"
     */
    handlerRoute?: string;
    /** Queue topic triggers to subscribe to. */
    triggers: Array<{
      topic: string;
      retryAfterSeconds?: number;
      initialDelaySeconds?: number;
    }>;
  };

  /**
   * Per-route function configuration overrides.
   *
   * Keys are route patterns (e.g., `/api/queues/*`, `/api/slow-routes/**`).
   * Values are partial {@link VercelServerlessFunctionConfig} objects.
   *
   * @example
   * ```ts
   * functionRules: {
   *   '/api/my-slow-routes/**': { maxDuration: 3600 },
   *   '/api/queues/fulfill-order': {
   *     experimentalTriggers: [{ type: 'queue/v2beta', topic: 'orders' }],
   *   },
   * }
   * ```
   */
  functionRules?: Record<string, VercelServerlessFunctionConfig>;
}

/**
 * https://vercel.com/docs/build-output-api/v3/primitives#prerender-configuration-file
 */
export type PrerenderFunctionConfig = {
  /**
   * Expiration time (in seconds) before the cached asset will be re-generated by invoking the Serverless Function. Setting the value to `false` means it will never expire.
   */
  expiration: number | false;

  /**
   * Option group number of the asset. Prerender assets with the same group number will all be re-validated at the same time.
   */
  group?: number;

  /** Random token assigned to the `__prerender_bypass` cookie when Draft Mode is enabled, in order to safely bypass the Edge Network cache */
  bypassToken?: string;

  /**
   * Name of the optional fallback file relative to the configuration file.
   */
  fallback?: string;

  /**
   * List of query string parameter names that will be cached independently. If an empty array, query values are not considered for caching. If undefined each unique query value is cached independently
   */
  allowQuery?: string[];

  /**
   * When `true`, the query string will be present on the `request` argument passed to the invoked function. The `allowQuery` filter still applies.
   */
  passQuery?: boolean;

  /**
   * (vercel)
   *
   * When `true`, expose the response body regardless of status code including error status codes. (default `false`)
   */
  exposeErrBody?: boolean;
};

declare module "nitro/types" {
  export interface NitroRuntimeHooks {
    "vercel:queue": (_: {
      message: unknown;
      metadata: import("@vercel/queue").MessageMetadata;
      send: typeof send;
    }) => void;
  }
}
