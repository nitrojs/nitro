/**
 * Copyright (c) 2020 Cloudflare, Inc. <wrangler@cloudflare.com>
 * https://github.com/cloudflare/workers-sdk/blob/main/LICENSE-MIT
 * https://github.com/cloudflare/workers-sdk/blob/main/LICENSE-APACHE
 *
 * Source: https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/config/environment.ts
 */

/**
 * The `Environment` interface declares all the configuration fields that
 * can be specified for an environment.
 *
 * This could be the top-level default environment, or a specific named environment.
 */
export interface Environment extends EnvironmentInheritable, EnvironmentNonInheritable {}

type SimpleRoute = string;
export type ZoneIdRoute = {
  pattern: string;
  zone_id: string;
  custom_domain?: boolean;
};
export type ZoneNameRoute = {
  pattern: string;
  zone_name: string;
  custom_domain?: boolean;
};
export type CustomDomainRoute = { pattern: string; custom_domain: boolean };
export type Route = SimpleRoute | ZoneIdRoute | ZoneNameRoute | CustomDomainRoute;

/**
 * Configuration in wrangler for Cloudchamber
 */
export type CloudchamberConfig = {
  image?: string;
  location?: string;
  instance_type?: "dev" | "basic" | "standard";
  vcpu?: number;
  memory?: string;
  ipv4?: boolean;
};

/**
 * Configuration for a container application
 */
export type ContainerApp = {
  // TODO: fill out the entire type

  /**
   * Name of the application
   * @optional Defaults to `worker_name-class_name` if not specified.
   */
  name?: string;

  /**
   * Number of application instances
   * @deprecated
   * @hidden
   */
  instances?: number;

  /**
   * Number of maximum application instances.
   * @optional
   */
  max_instances?: number;

  /**
   * The path to a Dockerfile, or an image URI for the Cloudflare registry.
   */
  image: string;

  /**
   * Build context of the application.
   * @optional - defaults to the directory of `image`.
   */
  image_build_context?: string;

  /**
   * Image variables to be passed along the image at build time.
   * @optional
   */
  image_vars?: Record<string, string>;

  /**
   * The class name of the Durable Object the container is connected to.
   */
  class_name: string;

  /**
   * The scheduling policy of the application
   * @optional
   * @default "default"
   */
  scheduling_policy?: "regional" | "moon" | "default";

  /**
   * The instance type to be used for the container. This sets preconfigured options for vcpu and memory
   * @optional
   */
  instance_type?: "dev" | "basic" | "standard";

  /**
   * @deprecated Use top level `containers` fields instead.
   * `configuration.image` should be `image`
   * `configuration.disk` should be set via `instance_type`
   * @hidden
   */
  configuration?: {
    image?: string;
    labels?: { name: string; value: string }[];
    secrets?: { name: string; type: "env"; secret: string }[];
    disk?: { size: string };
  };

  /**
   * Scheduling constraints
   * @hidden
   */
  constraints?: {
    regions?: string[];
    cities?: string[];
    tier?: number;
  };

  /**
   * @deprecated use the `class_name` field instead.
   * @hidden
   */
  durable_objects?: {
    namespace_id: string;
  };

  /**
   * How a rollout should be done, defining the size of it
   * @optional
   * @default 25
   * */
  rollout_step_percentage?: number;

  /**
   * How a rollout should be created. It supports the following modes:
   *  - full_auto: The container application will be rolled out fully automatically.
   *  - none: The container application won't have a roll out or update.
   *  - manual: The container application will be rollout fully by manually actioning progress steps.
   * @optional
   * @default "full_auto"
   */
  rollout_kind?: "full_auto" | "none" | "full_manual";
};

/**
 * Configuration in wrangler for Durable Object Migrations
 */
export type DurableObjectMigration = {
  /** A unique identifier for this migration. */
  tag: string;
  /** The new Durable Objects being defined. */
  new_classes?: string[];
  /** The new SQLite Durable Objects being defined. */
  new_sqlite_classes?: string[];
  /** The Durable Objects being renamed. */
  renamed_classes?: {
    from: string;
    to: string;
  }[];
  /** The Durable Objects being removed. */
  deleted_classes?: string[];
};

/**
 * The `EnvironmentInheritable` interface declares all the configuration fields for an environment
 * that can be inherited (and overridden) from the top-level environment.
 */
interface EnvironmentInheritable {
  /**
   * The name of your Worker. Alphanumeric + dashes only.
   *
   * @inheritable
   */
  name: string | undefined;

  /**
   * This is the ID of the account associated with your zone.
   * You might have more than one account, so make sure to use
   * the ID of the account associated with the zone/route you
   * provide, if you provide one. It can also be specified through
   * the CLOUDFLARE_ACCOUNT_ID environment variable.
   *
   * @inheritable
   */
  account_id: string | undefined;

  /**
   * A date in the form yyyy-mm-dd, which will be used to determine
   * which version of the Workers runtime is used.
   *
   * More details at https://developers.cloudflare.com/workers/configuration/compatibility-dates
   *
   * @inheritable
   */
  compatibility_date: string | undefined;

  /**
   * A list of flags that enable features from upcoming features of
   * the Workers runtime, usually used together with compatibility_date.
   *
   * More details at https://developers.cloudflare.com/workers/configuration/compatibility-flags/
   *
   * @default []
   * @inheritable
   */
  compatibility_flags: string[];

  /**
   * The entrypoint/path to the JavaScript file that will be executed.
   *
   * @inheritable
   */
  main: string | undefined;

  /**
   * If true then Wrangler will traverse the file tree below `base_dir`;
   * Any files that match `rules` will be included in the deployed Worker.
   * Defaults to true if `no_bundle` is true, otherwise false.
   *
   * @inheritable
   */
  find_additional_modules: boolean | undefined;

  /**
   * Determines whether Wrangler will preserve bundled file names.
   * Defaults to false.
   * If left unset, files will be named using the pattern ${fileHash}-${basename},
   * for example, `34de60b44167af5c5a709e62a4e20c4f18c9e3b6-favicon.ico`.
   *
   * @inheritable
   */
  preserve_file_names: boolean | undefined;

  /**
   * The directory in which module rules should be evaluated when including additional files into a Worker deployment.
   * This defaults to the directory containing the `main` entry point of the Worker if not specified.
   *
   * @inheritable
   */
  base_dir: string | undefined;

  // Carmen according to our tests the default is undefined
  // warning: you must force "workers_dev: true" in tests to match expected behavior
  /**
   * Whether we use <name>.<subdomain>.workers.dev to
   * test and deploy your Worker.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#workersdev
   *
   * @default true
   * @breaking
   * @inheritable
   */

  workers_dev: boolean | undefined;

  /**
   * Whether we use <version>-<name>.<subdomain>.workers.dev to
   * serve Preview URLs for your Worker.
   *
   * @default true
   * @inheritable
   */
  preview_urls: boolean | undefined;

  /**
   * A list of routes that your Worker should be published to.
   * Only one of `routes` or `route` is required.
   *
   * Only required when workers_dev is false, and there's no scheduled Worker (see `triggers`)
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#types-of-routes
   *
   * @inheritable
   */
  routes: Route[] | undefined;

  /**
   * A route that your Worker should be published to. Literally
   * the same as routes, but only one.
   * Only one of `routes` or `route` is required.
   *
   * Only required when workers_dev is false, and there's no scheduled Worker
   *
   * @inheritable
   */
  route: Route | undefined;

  /**
   * Path to a custom tsconfig
   *
   * @inheritable
   */
  tsconfig: string | undefined;

  /**
   * The function to use to replace jsx syntax.
   *
   * @default "React.createElement"
   * @inheritable
   */
  jsx_factory: string;

  /**
   * The function to use to replace jsx fragment syntax.
   *
   * @default "React.Fragment"
   * @inheritable
   */
  jsx_fragment: string;

  /**
   * A list of migrations that should be uploaded with your Worker.
   *
   * These define changes in your Durable Object declarations.
   *
   * More details at https://developers.cloudflare.com/workers/learning/using-durable-objects#configuring-durable-object-classes-with-migrations
   *
   * @default []
   * @inheritable
   */
  migrations: DurableObjectMigration[];

  /**
   * "Cron" definitions to trigger a Worker's "scheduled" function.
   *
   * Lets you call Workers periodically, much like a cron job.
   *
   * More details here https://developers.cloudflare.com/workers/platform/cron-triggers
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers
   *
   * @default {crons: undefined}
   * @inheritable
   */
  triggers: { crons: string[] | undefined };

  /**
   * Specify limits for runtime behavior.
   * Only supported for the "standard" Usage Model
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#limits
   *
   * @inheritable
   */
  limits: UserLimits | undefined;

  /**
   * An ordered list of rules that define which modules to import,
   * and what type to import them as. You will need to specify rules
   * to use Text, Data, and CompiledWasm modules, or when you wish to
   * have a .js file be treated as an ESModule instead of CommonJS.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#bundling
   *
   * @inheritable
   */
  rules: Rule[];

  /**
   * Configures a custom build step to be run by Wrangler when building your Worker.
   *
   * Refer to the [custom builds documentation](https://developers.cloudflare.com/workers/cli-wrangler/configuration#build)
   * for more details.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#custom-builds
   *
   * @default {watch_dir:"./src"}
   */
  build: {
    /** The command used to build your Worker. On Linux and macOS, the command is executed in the `sh` shell and the `cmd` shell for Windows. The `&&` and `||` shell operators may be used. */
    command?: string;
    /** The directory in which the command is executed. */
    cwd?: string;
    /** The directory to watch for changes while using wrangler dev, defaults to the current working directory */
    watch_dir?: string | string[];
  };

  /**
   * Skip internal build steps and directly deploy script
   * @inheritable
   */
  no_bundle: boolean | undefined;

  /**
   * Minify the script before uploading.
   * @inheritable
   */
  minify: boolean | undefined;

  /**
   * Set the `name` property to the original name for functions and classes renamed during minification.
   *
   * See https://esbuild.github.io/api/#keep-names
   *
   * @default true
   * @inheritable
   */
  keep_names: boolean | undefined;

  /**
   * Designates this Worker as an internal-only "first-party" Worker.
   *
   * @inheritable
   */
  first_party_worker: boolean | undefined;

  /**
   * List of bindings that you will send to logfwdr
   *
   * @default {bindings:[]}
   * @inheritable
   */
  logfwdr: {
    bindings: {
      /** The binding name used to refer to logfwdr */
      name: string;
      /** The destination for this logged message */
      destination: string;
    }[];
  };

  /**
   * Send Trace Events from this Worker to Workers Logpush.
   *
   * This will not configure a corresponding Logpush job automatically.
   *
   * For more information about Workers Logpush, see:
   * https://blog.cloudflare.com/logpush-for-workers/
   *
   * @inheritable
   */
  logpush: boolean | undefined;

  /**
   * Include source maps when uploading this worker.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#source-maps
   *
   * @inheritable
   */
  upload_source_maps: boolean | undefined;

  /**
   * Specify how the Worker should be located to minimize round-trip time.
   *
   * More details: https://developers.cloudflare.com/workers/platform/smart-placement/
   *
   * @inheritable
   */
  placement: { mode: "off" | "smart"; hint?: string } | undefined;

  /**
   * Specify the directory of static assets to deploy/serve
   *
   * More details at https://developers.cloudflare.com/workers/frameworks/
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#assets
   *
   * @inheritable
   */
  assets: Assets | undefined;

  /**
   * Specify the observability behavior of the Worker.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#observability
   *
   * @inheritable
   */
  observability: Observability | undefined;

  /**
   * Specify the compliance region mode of the Worker.
   *
   * Although if the user does not specify a compliance region, the default is `public`,
   * it can be set to `undefined` in configuration to delegate to the CLOUDFLARE_COMPLIANCE_REGION environment variable.
   */
  compliance_region: "public" | "fedramp_high" | undefined;
}

export type DurableObjectBindings = {
  /** The name of the binding used to refer to the Durable Object */
  name: string;
  /** The exported class name of the Durable Object */
  class_name: string;
  /** The script where the Durable Object is defined (if it's external to this Worker) */
  script_name?: string;
  /** The service environment of the script_name to bind to */
  environment?: string;
}[];

export type WorkflowBinding = {
  /** The name of the binding used to refer to the Workflow */
  binding: string;
  /** The name of the Workflow */
  name: string;
  /** The exported class name of the Workflow */
  class_name: string;
  /** The script where the Workflow is defined (if it's external to this Worker) */
  script_name?: string;
  /** Whether the Workflow should be remote or not (only available under `--x-remote-bindings`) */
  experimental_remote?: boolean;
};

/**
 * The `EnvironmentNonInheritable` interface declares all the configuration fields for an environment
 * that cannot be inherited from the top-level environment, and must be defined specifically.
 *
 * If any of these fields are defined at the top-level then they should also be specifically defined
 * for each named environment.
 */
export interface EnvironmentNonInheritable {
  /**
   * A map of values to substitute when deploying your Worker.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default {}
   * @nonInheritable
   */
  define: Record<string, string>;
  /**
   * A map of environment variables to set when deploying your Worker.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#environment-variables
   *
   * @default {}
   * @nonInheritable
   */
  vars: Record<string, unknown>;

  /**
   * A list of durable objects that your Worker should be bound to.
   *
   * For more information about Durable Objects, see the documentation at
   * https://developers.cloudflare.com/workers/learning/using-durable-objects
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#durable-objects
   *
   * @default {bindings:[]}
   * @nonInheritable
   */
  durable_objects: {
    bindings: DurableObjectBindings;
  };

  /**
   * A list of workflows that your Worker should be bound to.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default []
   * @nonInheritable
   */
  workflows: WorkflowBinding[];

  /**
   * Cloudchamber configuration
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default {}
   * @nonInheritable
   */
  cloudchamber: CloudchamberConfig;

  /**
   * Container related configuration
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default []
   * @nonInheritable
   */
  containers?: ContainerApp[];

  /**
   * These specify any Workers KV Namespaces you want to
   * access from inside your Worker.
   *
   * To learn more about KV Namespaces,
   * see the documentation at https://developers.cloudflare.com/workers/learning/how-kv-works
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#kv-namespaces
   *
   * @default []
   * @nonInheritable
   */
  kv_namespaces: {
    /** The binding name used to refer to the KV Namespace */
    binding: string;
    /** The ID of the KV namespace */
    id?: string;
    /** The ID of the KV namespace used during `wrangler dev` */
    preview_id?: string;
    /** Whether the KV namespace should be remote or not (only available under `--x-remote-bindings`) */
    experimental_remote?: boolean;
  }[];

  /**
   * These specify bindings to send email from inside your Worker.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#email-bindings
   *
   * @default []
   * @nonInheritable
   */
  send_email: {
    /** The binding name used to refer to the this binding */
    name: string;
    /** If this binding should be restricted to a specific verified address */
    destination_address?: string;
    /** If this binding should be restricted to a set of verified addresses */
    allowed_destination_addresses?: string[];
  }[];

  /**
   * Specifies Queues that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#queues
   *
   * @default {consumers:[],producers:[]}
   * @nonInheritable
   */
  queues: {
    /** Producer bindings */
    producers?: {
      /** The binding name used to refer to the Queue in the Worker. */
      binding: string;

      /** The name of this Queue. */
      queue: string;

      /** The number of seconds to wait before delivering a message */
      delivery_delay?: number;

      /** Whether the Queue producer should be remote or not (only available under `--x-remote-bindings`) */
      experimental_remote?: boolean;
    }[];

    /** Consumer configuration */
    consumers?: {
      /** The name of the queue from which this consumer should consume. */
      queue: string;

      /** The consumer type, e.g., worker, http-pull, r2-bucket, etc. Default is worker. */
      type?: string;

      /** The maximum number of messages per batch */
      max_batch_size?: number;

      /** The maximum number of seconds to wait to fill a batch with messages. */
      max_batch_timeout?: number;

      /** The maximum number of retries for each message. */
      max_retries?: number;

      /** The queue to send messages that failed to be consumed. */
      dead_letter_queue?: string;

      /** The maximum number of concurrent consumer Worker invocations. Leaving this unset will allow your consumer to scale to the maximum concurrency needed to keep up with the message backlog. */
      max_concurrency?: number | null;

      /** The number of milliseconds to wait for pulled messages to become visible again */
      visibility_timeout_ms?: number;

      /** The number of seconds to wait before retrying a message */
      retry_delay?: number;
    }[];
  };

  /**
   * Specifies R2 buckets that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#r2-buckets
   *
   * @default []
   * @nonInheritable
   */
  r2_buckets: {
    /** The binding name used to refer to the R2 bucket in the Worker. */
    binding: string;
    /** The name of this R2 bucket at the edge. */
    bucket_name?: string;
    /** The preview name of this R2 bucket at the edge. */
    preview_bucket_name?: string;
    /** The jurisdiction that the bucket exists in. Default if not present. */
    jurisdiction?: string;
    /** Whether the R2 bucket should be remote or not (only available under `--x-remote-bindings`) */
    experimental_remote?: boolean;
  }[];

  /**
   * Specifies D1 databases that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases
   *
   * @default []
   * @nonInheritable
   */
  d1_databases: {
    /** The binding name used to refer to the D1 database in the Worker. */
    binding: string;
    /** The name of this D1 database. */
    database_name?: string;
    /** The UUID of this D1 database (not required). */
    database_id?: string;
    /** The UUID of this D1 database for Wrangler Dev (if specified). */
    preview_database_id?: string;
    /** The name of the migrations table for this D1 database (defaults to 'd1_migrations'). */
    migrations_table?: string;
    /** The path to the directory of migrations for this D1 database (defaults to './migrations'). */
    migrations_dir?: string;
    /** Internal use only. */
    database_internal_env?: string;
    /** Whether the D1 database should be remote or not (only available under `--x-remote-bindings`) */
    experimental_remote?: boolean;
  }[];

  /**
   * Specifies Vectorize indexes that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#vectorize-indexes
   *
   * @default []
   * @nonInheritable
   */
  vectorize: {
    /** The binding name used to refer to the Vectorize index in the Worker. */
    binding: string;
    /** The name of the index. */
    index_name: string;
    /** Whether the Vectorize index should be remote or not (only available under `--x-remote-bindings`) */
    experimental_remote?: boolean;
  }[];

  /**
   * Specifies Hyperdrive configs that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#hyperdrive
   *
   * @default []
   * @nonInheritable
   */
  hyperdrive: {
    /** The binding name used to refer to the project in the Worker. */
    binding: string;
    /** The id of the database. */
    id: string;
    /** The local database connection string for `wrangler dev` */
    localConnectionString?: string;
  }[];

  /**
   * Specifies service bindings (Worker-to-Worker) that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#service-bindings
   *
   * @default []
   * @nonInheritable
   */
  services:
    | {
        /** The binding name used to refer to the bound service. */
        binding: string;
        /** The name of the service. */
        service: string;
        /** The environment of the service (e.g. production, staging, etc). */
        environment?: string;
        /** Optionally, the entrypoint (named export) of the service to bind to. */
        entrypoint?: string;
        /** Optional properties that will be made available to the service via ctx.props. */
        props?: Record<string, unknown>;
        /** Whether the service binding should be remote or not (only available under `--x-remote-bindings`) */
        experimental_remote?: boolean;
      }[]
    | undefined;

  /**
   * Specifies analytics engine datasets that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#analytics-engine-datasets
   *
   * @default []
   * @nonInheritable
   */
  analytics_engine_datasets: {
    /** The binding name used to refer to the dataset in the Worker. */
    binding: string;
    /** The name of this dataset to write to. */
    dataset?: string;
  }[];

  /**
   * A browser that will be usable from the Worker.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#browser-rendering
   *
   * @default {}
   * @nonInheritable
   */
  browser:
    | {
        binding: string;
        /** Whether the Browser binding should be remote or not (only available under `--x-remote-bindings`) */
        experimental_remote?: boolean;
      }
    | undefined;

  /**
   * Binding to the AI project.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#workers-ai
   *
   * @default {}
   * @nonInheritable
   */
  ai:
    | {
        binding: string;
        staging?: boolean;
        /** Whether the AI binding should be remote or not (only available under `--x-remote-bindings`) */
        experimental_remote?: boolean;
      }
    | undefined;

  /**
   * Binding to Cloudflare Images
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#images
   *
   * @default {}
   * @nonInheritable
   */
  images:
    | {
        binding: string;
        /** Whether the Images binding should be remote or not (only available under `--x-remote-bindings`) */
        experimental_remote?: boolean;
      }
    | undefined;

  /**
   * Binding to the Worker Version's metadata
   */
  version_metadata:
    | {
        binding: string;
      }
    | undefined;

  /**
   * "Unsafe" tables for features that aren't directly supported by wrangler.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default {}
   * @nonInheritable
   */
  unsafe: {
    /**
     * A set of bindings that should be put into a Worker's upload metadata without changes. These
     * can be used to implement bindings for features that haven't released and aren't supported
     * directly by wrangler or miniflare.
     */
    bindings?: {
      name: string;
      type: string;
      [key: string]: unknown;
    }[];

    /**
     * Arbitrary key/value pairs that will be included in the uploaded metadata.  Values specified
     * here will always be applied to metadata last, so can add new or override existing fields.
     */
    metadata?: {
      [key: string]: unknown;
    };

    /**
     * Used for internal capnp uploads for the Workers runtime
     */
    capnp?:
      | {
          base_path: string;
          source_schemas: string[];
          compiled_schema?: never;
        }
      | {
          base_path?: never;
          source_schemas?: never;
          compiled_schema: string;
        };
  };

  /**
   * Specifies a list of mTLS certificates that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#mtls-certificates
   *
   * @default []
   * @nonInheritable
   */
  mtls_certificates: {
    /** The binding name used to refer to the certificate in the Worker */
    binding: string;
    /** The uuid of the uploaded mTLS certificate */
    certificate_id: string;
    /** Whether the mtls fetcher should be remote or not (only available under `--x-remote-bindings`) */
    experimental_remote?: boolean;
  }[];

  /**
   * Specifies a list of Tail Workers that are bound to this Worker environment
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default []
   * @nonInheritable
   */
  tail_consumers?: TailConsumer[];

  /**
   * Specifies namespace bindings that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * For reference, see https://developers.cloudflare.com/workers/wrangler/configuration/#dispatch-namespace-bindings-workers-for-platforms
   *
   * @default []
   * @nonInheritable
   */
  dispatch_namespaces: {
    /** The binding name used to refer to the bound service. */
    binding: string;
    /** The namespace to bind to. */
    namespace: string;
    /** Details about the outbound Worker which will handle outbound requests from your namespace */
    outbound?: DispatchNamespaceOutbound;
    /** Whether the Dispatch Namespace should be remote or not (only available under `--x-remote-bindings`) */
    experimental_remote?: boolean;
  }[];

  /**
   * Specifies list of Pipelines bound to this Worker environment
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default []
   * @nonInheritable
   */
  pipelines: {
    /** The binding name used to refer to the bound service. */
    binding: string;

    /** Name of the Pipeline to bind */
    pipeline: string;
  }[];

  /**
   * Specifies Secret Store bindings that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default []
   * @nonInheritable
   */
  secrets_store_secrets: {
    /** The binding name used to refer to the bound service. */
    binding: string;

    /** Id of the secret store */
    store_id: string;

    /** Name of the secret */
    secret_name: string;
  }[];

  /**
   * **DO NOT USE**. Hello World Binding Config to serve as an explanatory example.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default []
   * @nonInheritable
   */
  unsafe_hello_world: {
    /** The binding name used to refer to the bound service. */
    binding: string;

    /** Whether the timer is enabled */
    enable_timer?: boolean;
  }[];
}

/**
 * The raw environment configuration that we read from the config file.
 *
 * All the properties are optional, and will be replaced with defaults in the configuration that
 * is used in the rest of the codebase.
 */
export type RawEnvironment = Partial<Environment>;

/**
 * A bundling resolver rule, defining the modules type for paths that match the specified globs.
 */
export type Rule = {
  type: ConfigModuleRuleType;
  globs: string[];
  fallthrough?: boolean;
};

/**
 * The possible types for a `Rule`.
 */
export type ConfigModuleRuleType =
  | "ESModule"
  | "CommonJS"
  | "CompiledWasm"
  | "Text"
  | "Data"
  | "PythonModule"
  | "PythonRequirement";

export type TailConsumer = {
  /** The name of the service tail events will be forwarded to. */
  service: string;
  /** (Optional) The environment of the service. */
  environment?: string;
};

export interface DispatchNamespaceOutbound {
  /** Name of the service handling the outbound requests */
  service: string;
  /** (Optional) Name of the environment handling the outbound requests. */
  environment?: string;
  /** (Optional) List of parameter names, for sending context from your dispatch Worker to the outbound handler */
  parameters?: string[];
}

export interface UserLimits {
  /** Maximum allowed CPU time for a Worker's invocation in milliseconds */
  cpu_ms: number;
}

export type Assets = {
  /** Absolute path to assets directory */
  directory?: string;
  /** Name of `env` binding property in the User Worker. */
  binding?: string;
  /** How to handle HTML requests. */
  html_handling?: "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | "none";
  /** How to handle requests that do not match an asset. */
  not_found_handling?: "single-page-application" | "404-page" | "none";
  /**
   * Matches will be routed to the User Worker, and matches to negative rules will go to the Asset Worker.
   *
   * Can also be `true`, indicating that every request should be routed to the User Worker.
   */
  run_worker_first?: string[] | boolean;
};

export interface Observability {
  /** If observability is enabled for this Worker */
  enabled?: boolean;
  /** The sampling rate */
  head_sampling_rate?: number;
  logs?: {
    enabled?: boolean;
    /** The sampling rate */
    head_sampling_rate?: number;
    /** Set to false to disable invocation logs */
    invocation_logs?: boolean;
  };
}

export type DockerConfiguration = {
  /** Socket used by miniflare to communicate with Docker */
  socketPath: string;
};

export type ContainerEngine =
  | {
      localDocker: DockerConfiguration;
    }
  | string;
