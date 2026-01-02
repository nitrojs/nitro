import type {
  ExecutionContext,
  ForwardableEmailMessage,
  MessageBatch,
  ScheduledController,
  TraceItem,
} from "@cloudflare/workers-types";
import type { DurableObject } from "cloudflare:workers";

import type {
  Config as _Config,
  ComputedFields as _ComputedFields,
} from "./wrangler/config.ts";

export type WranglerConfig = Partial<Omit<_Config, keyof _ComputedFields>>;

/**
 * https://developers.cloudflare.com/pages/platform/functions/routing/#functions-invocation-routes
 */
export interface CloudflarePagesRoutes {
  /** Defines the version of the schema. Currently there is only one version of the schema (version 1), however, we may add more in the future and aim to be backwards compatible. */
  version?: 1;

  /** Defines routes that will be invoked by Functions. Accepts wildcard behavior. */
  include?: string[];

  /** Defines routes that will not be invoked by Functions. Accepts wildcard behavior. `exclude` always take priority over `include`. */
  exclude?: string[];
}

export interface CloudflareOptions {
  /**
   * Configuration for the Cloudflare Deployments.
   *
   * **NOTE:** This option is only effective if `deployConfig` is enabled.
   */
  wrangler?: WranglerConfig;

  /**
   * Enable automatic generation of `.wrangler/deploy/config.json`.
   *
   * **IMPORTANT:** Enabling this option will cause settings from cloudflare dashboard (including environment variables) to be disabled and discarded.
   *
   * More info: https://developers.cloudflare.com/workers/wrangler/configuration#generated-wrangler-configuration
   */
  deployConfig?: boolean;

  /**
   * Enable native Node.js compatibility support.
   *
   * If this option disabled, pure unenv polyfills will be used instead.
   *
   * If not set, will be auto enabled if `nodejs_compat` or `nodejs_compat_v2` is detected in `wrangler.toml` or `wrangler.json`.
   */
  nodeCompat?: boolean;

  /**
   * Options for dev emulation.
   */
  dev?: {
    configPath?: string;
    environment?: string;
    persistDir?: string;
  };

  pages?: {
    /**
     * Nitro will automatically generate a `_routes.json` that controls which files get served statically and
     * which get served by the Worker. Using this config will override the automatic `_routes.json`. Or, if the
     * `merge` options is set, it will merge the user-set routes with the auto-generated ones, giving priority
     * to the user routes.
     *
     * @see https://developers.cloudflare.com/pages/platform/functions/routing/#functions-invocation-routes
     *
     * There are a maximum of 100 rules, and you must have at least one include rule. Wildcards are accepted.
     *
     * If any fields are unset, they default to:
     *
     * ```json
     * {
     *   "version": 1,
     *   "include": ["/*"],
     *   "exclude": []
     * }
     * ```
     */
    routes?: CloudflarePagesRoutes;
    /**
     * If set to `false`, nitro will disable the automatically generated `_routes.json` and instead use the user-set only ones.
     *
     * @default true
     */
    defaultRoutes?: boolean;
  };

  /**
   * Custom Cloudflare exports additional classes such as WorkflowEntrypoint.
   */
  exports?: string;

  /**
   * Options for Durable Objects.
   */
  durable?: {
    /**
     * The binding name for the Durable Object used by `defineWebSocketHandler`.
     *
     * Must match the `name` field in your wrangler.json `durable_objects.bindings` config.
     *
     * @default "$DurableObject"
     */
    bindingName?: string;
  };
}

type DurableObjectState = ConstructorParameters<typeof DurableObject>[0];

declare module "nitro/types" {
  export interface NitroRuntimeHooks {
    // https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
    "cloudflare:scheduled": (_: {
      controller: ScheduledController;
      env: unknown;
      context: ExecutionContext;
    }) => void;
    // https://developers.cloudflare.com/email-routing/email-workers/runtime-api
    "cloudflare:email": (_: {
      message: ForwardableEmailMessage;
      /** @deprecated please use `message` */
      event: ForwardableEmailMessage;
      env: unknown;
      context: ExecutionContext;
    }) => void;
    // https://developers.cloudflare.com/queues/configuration/javascript-apis/#consumer
    "cloudflare:queue": (_: {
      batch: MessageBatch;
      /** @deprecated please use `batch` */
      event: MessageBatch;
      env: unknown;
      context: ExecutionContext;
    }) => void;
    // https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/
    "cloudflare:tail": (_: {
      traces: TraceItem[];
      env: unknown;
      context: ExecutionContext;
    }) => void;
    "cloudflare:trace": (_: {
      traces: TraceItem[];
      env: unknown;
      context: ExecutionContext;
    }) => void;

    "cloudflare:durable:init": (
      durable: DurableObject,
      _: {
        state: DurableObjectState;
        env: unknown;
      }
    ) => void;

    "cloudflare:durable:alarm": (durable: DurableObject) => void;
  }
}
