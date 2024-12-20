// Source:
// - https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/config/config.ts
// - https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/config/environment.ts
// 4f47f7422786e537eaefd034153998f848bcd573

/**
 * This is the static type definition for the configuration object.
 *
 * It reflects a normalized and validated version of the configuration that you can write in wrangler.toml,
 * and optionally augment with arguments passed directly to wrangler.
 *
 * For more information about the configuration object, see the
 * documentation at https://developers.cloudflare.com/workers/cli-wrangler/configuration
 *
 * Notes:
 *
 * - Fields that are only specified in `ConfigFields` and not `Environment` can only appear
 * in the top level config and should not appear in any environments.
 * - Fields that are specified in `PagesConfigFields` are only relevant for Pages projects
 * - All top level fields in config and environments are optional in the wrangler.toml file.
 *
 * Legend for the annotations:
 *
 * - `@breaking`: the deprecation/optionality is a breaking change from Wrangler v1.
 * - `@todo`: there's more work to be done (with details attached).
 */
export type Config = Partial<
  ConfigFields<DevConfig> & PagesConfigFields & Environment
>;

export type RawConfig = Partial<ConfigFields<RawDevConfig>> &
  PagesConfigFields &
  RawEnvironment &
  DeprecatedConfigFields &
  EnvironmentMap & { $schema?: string };

// Pages-specific configuration fields
export interface PagesConfigFields {
  /**
   * The directory of static assets to serve.
   *
   * The presence of this field in `wrangler.toml` indicates a Pages project,
   * and will prompt the handling of the configuration file according to the
   * Pages-specific validation rules.
   */
  pages_build_output_dir?: string;
}

export interface ConfigFields<Dev extends RawDevConfig> {
  configPath: string | undefined;

  /**
   * A boolean to enable "legacy" style wrangler environments (from Wrangler v1).
   * These have been superseded by Services, but there may be projects that won't
   * (or can't) use them. If you're using a legacy environment, you can set this
   * to `true` to enable it.
   */
  legacy_env: boolean;

  /**
   * Whether Wrangler should send usage metrics to Cloudflare for this project.
   *
   * When defined this will override any user settings.
   * Otherwise, Wrangler will use the user's preference.
   */
  send_metrics: boolean | undefined;

  /**
   * Options to configure the development server that your worker will use.
   */
  dev: Dev;

  /**
   * A list of migrations that should be uploaded with your Worker.
   *
   * These define changes in your Durable Object declarations.
   *
   * More details at https://developers.cloudflare.com/workers/learning/using-durable-objects#configuring-durable-object-classes-with-migrations
   *
   * @default []
   */
  migrations: {
    /** A unique identifier for this migration. */
    tag: string;
    /** The new Durable Objects being defined. */
    new_classes?: string[];
    /** The Durable Objects being renamed. */
    renamed_classes?: {
      from: string;
      to: string;
    }[];
    /** The Durable Objects being removed. */
    deleted_classes?: string[];
  }[];

  /**
   * The definition of a Worker Site, a feature that lets you upload
   * static assets with your Worker.
   *
   * More details at https://developers.cloudflare.com/workers/platform/sites
   */
  site:
    | {
        /**
         * The directory containing your static assets.
         *
         * It must be a path relative to your wrangler.toml file.
         * Example: bucket = "./public"
         *
         * If there is a `site` field then it must contain this `bucket` field.
         */
        bucket: string;

        /**
         * The location of your Worker script.
         *
         * @deprecated DO NOT use this (it's a holdover from Wrangler v1.x). Either use the top level `main` field, or pass the path to your entry file as a command line argument.
         * @breaking
         */
        "entry-point"?: string;

        /**
         * An exclusive list of .gitignore-style patterns that match file
         * or directory names from your bucket location. Only matched
         * items will be uploaded. Example: include = ["upload_dir"]
         *
         * @optional
         * @default []
         */
        include?: string[];

        /**
         * A list of .gitignore-style patterns that match files or
         * directories in your bucket that should be excluded from
         * uploads. Example: exclude = ["ignore_dir"]
         *
         * @optional
         * @default []
         */
        exclude?: string[];
      }
    | undefined;

  /**
   * Serve a folder of static assets with your Worker, without any additional code.
   * This can either be a string, or an object with additional config fields.
   */
  assets:
    | {
        bucket: string;
        include: string[];
        exclude: string[];
        browser_TTL: number | undefined;
        serve_single_page_app: boolean;
      }
    | undefined;

  /**
   * A list of wasm modules that your worker should be bound to. This is
   * the "legacy" way of binding to a wasm module. ES module workers should
   * do proper module imports.
   */
  wasm_modules:
    | {
        [key: string]: string;
      }
    | undefined;

  /**
   * A list of text files that your worker should be bound to. This is
   * the "legacy" way of binding to a text file. ES module workers should
   * do proper module imports.
   */
  text_blobs:
    | {
        [key: string]: string;
      }
    | undefined;

  /**
   * A list of data files that your worker should be bound to. This is
   * the "legacy" way of binding to a data file. ES module workers should
   * do proper module imports.
   */
  data_blobs:
    | {
        [key: string]: string;
      }
    | undefined;

  /**
   * By default, wrangler.toml is the source of truth for your environment configuration, like a terraform file.
   *
   * If you change your vars in the dashboard, wrangler *will* override/delete them on its next deploy.
   *
   * If you want to keep your dashboard vars when wrangler deploys, set this field to true.
   *
   * @default false
   * @nonInheritable
   */
  keep_vars?: boolean;
}

// Pages-specific configuration fields
export interface PagesConfigFields {
  /**
   * The directory of static assets to serve.
   *
   * The presence of this field in `wrangler.toml` indicates a Pages project,
   * and will prompt the handling of the configuration file according to the
   * Pages-specific validation rules.
   */
  pages_build_output_dir?: string;
}

export interface DevConfig {
  /**
   * IP address for the local dev server to listen on,
   *
   * @default localhost
   */
  ip: string;

  /**
   * Port for the local dev server to listen on
   *
   * @default 8787
   */
  port: number | undefined;

  /**
   * Port for the local dev server's inspector to listen on
   *
   * @default 9229
   */
  inspector_port: number | undefined;

  /**
   * Protocol that local wrangler dev server listens to requests on.
   *
   * @default http
   */
  local_protocol: "http" | "https";

  /**
   * Protocol that wrangler dev forwards requests on
   *
   * Setting this to `http` is not currently implemented for remote mode.
   * See https://github.com/cloudflare/workers-sdk/issues/583
   *
   * @default https
   */
  upstream_protocol: "https" | "http";

  /**
   * Host to forward requests to, defaults to the host of the first route of project
   */
  host: string | undefined;
}

export type RawDevConfig = Partial<DevConfig>;

export interface DeprecatedConfigFields {
  /**
   * The project "type". A holdover from Wrangler v1.x.
   * Valid values were "webpack", "javascript", and "rust".
   *
   * @deprecated DO NOT USE THIS. Most common features now work out of the box with wrangler, including modules, jsx, typescript, etc. If you need anything more, use a custom build.
   * @breaking
   */
  type?: "webpack" | "javascript" | "rust";

  /**
   * Path to the webpack config to use when building your worker.
   * A holdover from Wrangler v1.x, used with `type: "webpack"`.
   *
   * @deprecated DO NOT USE THIS. Most common features now work out of the box with wrangler, including modules, jsx, typescript, etc. If you need anything more, use a custom build.
   * @breaking
   */
  webpack_config?: string;

  /**
   * Configuration only used by a standalone use of the miniflare binary.
   * @deprecated
   */
  miniflare?: unknown;
}

interface EnvironmentMap {
  /**
   * The `env` section defines overrides for the configuration for different environments.
   *
   * All environment fields can be specified at the top level of the config indicating the default environment settings.
   *
   * - Some fields are inherited and overridable in each environment.
   * - But some are not inherited and must be explicitly specified in every environment, if they are specified at the top level.
   *
   * For more information, see the documentation at https://developers.cloudflare.com/workers/cli-wrangler/configuration#environments
   *
   * @default {}
   */
  env?: {
    [envName: string]: RawEnvironment;
  };
}

/**
 * The `Environment` interface declares all the configuration fields that
 * can be specified for an environment.
 *
 * This could be the top-level default environment, or a specific named environment.
 */
export interface Environment
  extends EnvironmentInheritable,
    EnvironmentNonInheritable {}

export type SimpleRoute = string;
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
export type Route =
  | SimpleRoute
  | ZoneIdRoute
  | ZoneNameRoute
  | CustomDomainRoute;

/**
 * Configuration in wrangler for Cloudchamber
 */
export type CloudchamberConfig = {
  vcpu?: number;
  memory?: string;
};

/**
 * The `EnvironmentInheritable` interface declares all the configuration fields for an environment
 * that can be inherited (and overridden) from the top-level environment.
 */
interface EnvironmentInheritable {
  /**
   * The name of your worker. Alphanumeric + dashes only.
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
   * More details at https://developers.cloudflare.com/workers/platform/compatibility-dates
   *
   * @inheritable
   */
  compatibility_date: string | undefined;

  /**
   * A list of flags that enable features from upcoming features of
   * the Workers runtime, usually used together with compatibility_flags.
   *
   * More details at https://developers.cloudflare.com/workers/platform/compatibility-dates
   *
   * @inheritable
   */
  compatibility_flags: string[];

  /**
   * The entrypoint/path to the JavaScript file that will be executed.
   */
  main: string | undefined;

  /**
   * If true then Wrangler will traverse the file tree below `base_dir`;
   * Any files that match `rules` will be included in the deployed worker.
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
   */
  preserve_file_names: boolean | undefined;

  /**
   * The directory in which module rules should be evaluated when including additional files into a worker deployment.
   * This defaults to the directory containing the `main` entry point of the worker if not specified.
   *
   * @inheritable
   */
  base_dir: string | undefined;

  /**
   * Whether we use <name>.<subdomain>.workers.dev to
   * test and deploy your worker.
   *
   * @default `true` (This is a breaking change from Wrangler v1)
   * @breaking
   * @inheritable
   */
  workers_dev: boolean | undefined;

  /**
   * A list of routes that your worker should be published to.
   * Only one of `routes` or `route` is required.
   *
   * Only required when workers_dev is false, and there's no scheduled worker (see `triggers`)
   *
   * @inheritable
   */
  routes: Route[] | undefined;

  /**
   * A route that your worker should be published to. Literally
   * the same as routes, but only one.
   * Only one of `routes` or `route` is required.
   *
   * Only required when workers_dev is false, and there's no scheduled worker
   *
   * @inheritable
   */
  route: Route | undefined;

  /**
   * Path to a custom tsconfig
   */
  tsconfig: string | undefined;

  /**
   * The function to use to replace jsx syntax.
   *
   * @default `"React.createElement"`
   * @inheritable
   */
  jsx_factory: string;

  /**
   * The function to use to replace jsx fragment syntax.
   *
   * @default `"React.Fragment"`
   * @inheritable
   */
  jsx_fragment: string;

  /**
   * "Cron" definitions to trigger a worker's "scheduled" function.
   *
   * Lets you call workers periodically, much like a cron job.
   *
   * More details here https://developers.cloudflare.com/workers/platform/cron-triggers
   *
   * @default `{crons:[]}`
   * @inheritable
   */
  triggers: { crons: string[] };

  /**
   * Specifies the Usage Model for your Worker. There are two options -
   * [bundled](https://developers.cloudflare.com/workers/platform/limits#bundled-usage-model) and
   * [unbound](https://developers.cloudflare.com/workers/platform/limits#unbound-usage-model).
   * For newly created Workers, if the Usage Model is omitted
   * it will be set to the [default Usage Model set on the account](https://dash.cloudflare.com/?account=workers/default-usage-model).
   * For existing Workers, if the Usage Model is omitted, it will be
   * set to the Usage Model configured in the dashboard for that Worker.
   *
   * @inheritable
   */
  usage_model: "bundled" | "unbound" | undefined;

  /**
   * Specify limits for runtime behavior.
   * Only supported for the "standard" Usage Model
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
   * @inheritable
   */
  rules: Rule[];

  /**
   * Configures a custom build step to be run by Wrangler when building your Worker.
   *
   * Refer to the [custom builds documentation](https://developers.cloudflare.com/workers/cli-wrangler/configuration#build)
   * for more details.
   *
   * @default {}
   */
  build: {
    /** The command used to build your Worker. On Linux and macOS, the command is executed in the `sh` shell and the `cmd` shell for Windows. The `&&` and `||` shell operators may be used. */
    command?: string;
    /** The directory in which the command is executed. */
    cwd?: string;
    /** The directory to watch for changes while using wrangler dev, defaults to the current working directory */
    watch_dir?: string | string[];
    /**
     * Deprecated field previously used to configure the build and upload of the script.
     * @deprecated
     */
    upload?: DeprecatedUpload;
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
   * Add polyfills for node builtin modules and globals
   * @inheritable
   */
  node_compat: boolean | undefined;

  /**
   * Specifies namespace bindings that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `[]`
   * @nonInheritable
   */
  dispatch_namespaces: {
    /** The binding name used to refer to the bound service. */
    binding: string;
    /** The namespace to bind to. */
    namespace: string;
    /** Details about the outbound worker which will handle outbound requests from your namespace */
    outbound?: DispatchNamespaceOutbound;
  }[];

  /**
   *	Designates this worker as an internal-only "first-party" worker.
   */
  first_party_worker: boolean | undefined;

  /**
   * TODO: remove this as it has been deprecated.
   *
   * This is just here for now because the `route` commands use it.
   * So we need to include it in this type so it is available.
   */
  zone_id?: string;

  /**
   * List of bindings that you will send to logfwdr
   *
   * @default `{bindings:[]}`
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
   * Send Trace Events from this worker to Workers Logpush.
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
   * @inheritable
   */
  upload_source_maps: boolean | undefined;

  /**
   * Specify how the worker should be located to minimize round-trip time.
   *
   * More details: https://developers.cloudflare.com/workers/platform/smart-placement/
   */
  placement: { mode: "off" | "smart" } | undefined;
}

export type DurableObjectBindings = {
  /** The name of the binding used to refer to the Durable Object */
  name: string;
  /** The exported class name of the Durable Object */
  class_name: string;
  /** The script where the Durable Object is defined (if it's external to this worker) */
  script_name?: string;
  /** The service environment of the script_name to bind to */
  environment?: string;
}[];

/**
 * The `EnvironmentNonInheritable` interface declares all the configuration fields for an environment
 * that cannot be inherited from the top-level environment, and must be defined specifically.
 *
 * If any of these fields are defined at the top-level then they should also be specifically defined
 * for each named environment.
 */
export interface EnvironmentNonInheritable {
  /**
   * A map of values to substitute when deploying your worker.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `{}`
   * @nonInheritable
   */
  define: Record<string, string>;
  /**
   * A map of environment variables to set when deploying your worker.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `{}`
   * @nonInheritable
   */
  vars: Record<string, string | unknown /* Json */>;

  /**
   * A list of durable objects that your worker should be bound to.
   *
   * For more information about Durable Objects, see the documentation at
   * https://developers.cloudflare.com/workers/learning/using-durable-objects
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `{bindings:[]}`
   * @nonInheritable
   */
  durable_objects: {
    bindings: DurableObjectBindings;
  };

  /**
   * Cloudchamber configuration
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `{}`
   * @nonInheritable
   */
  cloudchamber: CloudchamberConfig;

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
   * @default `[]`
   * @nonInheritable
   */
  kv_namespaces: {
    /** The binding name used to refer to the KV Namespace */
    binding: string;
    /** The ID of the KV namespace */
    id: string;
    /** The ID of the KV namespace used during `wrangler dev` */
    preview_id?: string;
  }[];

  /**
   * These specify bindings to send email from inside your Worker.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `[]`
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
   * @default `{}`
   * @nonInheritable
   */
  queues: {
    /** Producer bindings */
    producers?: {
      /** The binding name used to refer to the Queue in the worker. */
      binding: string;

      /** The name of this Queue. */
      queue: string;

      /** The number of seconds to wait before delivering a message */
      delivery_delay?: number;
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
   * @default `[]`
   * @nonInheritable
   */
  r2_buckets: {
    /** The binding name used to refer to the R2 bucket in the worker. */
    binding: string;
    /** The name of this R2 bucket at the edge. */
    bucket_name: string;
    /** The preview name of this R2 bucket at the edge. */
    preview_bucket_name?: string;
    /** The jurisdiction that the bucket exists in. Default if not present. */
    jurisdiction?: string;
  }[];

  /**
   * Specifies D1 databases that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `[]`
   * @nonInheritable
   */
  d1_databases: {
    /** The binding name used to refer to the D1 database in the worker. */
    binding: string;
    /** The name of this D1 database. */
    database_name: string;
    /** The UUID of this D1 database (not required). */
    database_id: string;
    /** The UUID of this D1 database for Wrangler Dev (if specified). */
    preview_database_id?: string;
    /** The name of the migrations table for this D1 database (defaults to 'd1_migrations'). */
    migrations_table?: string;
    /** The path to the directory of migrations for this D1 database (defaults to './migrations'). */
    migrations_dir?: string;
    /** Internal use only. */
    database_internal_env?: string;
  }[];

  /**
   * Specifies Vectorize indexes that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `[]`
   * @nonInheritable
   */
  vectorize: {
    /** The binding name used to refer to the Vectorize index in the worker. */
    binding: string;
    /** The name of the index. */
    index_name: string;
  }[];

  /**
   * Specifies Constellation projects that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `[]`
   * @nonInheritable
   */
  constellation: {
    /** The binding name used to refer to the project in the worker. */
    binding: string;
    /** The id of the project. */
    project_id: string;
  }[];

  /**
   * Specifies Hyperdrive configs that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `[]`
   * @nonInheritable
   */
  hyperdrive: {
    /** The binding name used to refer to the project in the worker. */
    binding: string;
    /** The id of the database. */
    id: string;
    /** The local database connection string for `wrangler dev` */
    localConnectionString?: string;
  }[];

  /**
   * Specifies service bindings (worker-to-worker) that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `[]`
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
      }[]
    | undefined;

  /**
   * Specifies analytics engine datasets that are bound to this Worker environment.
   *
   * NOTE: This field is not automatically inherited from the top level environment,
   * and so must be specified in every named environment.
   *
   * @default `[]`
   * @nonInheritable
   */
  analytics_engine_datasets: {
    /** The binding name used to refer to the dataset in the worker. */
    binding: string;
    /** The name of this dataset to write to. */
    dataset?: string;
  }[];

  /**
   * A browser that will be usable from the worker.
   */
  browser:
    | {
        binding: string;
      }
    | undefined;

  /**
   * Binding to the AI project.
   */
  ai:
    | {
        binding: string;
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

  mtls_certificates: {
    /** The binding name used to refer to the certificate in the worker */
    binding: string;
    /** The uuid of the uploaded mTLS certificate */
    certificate_id: string;
  }[];

  tail_consumers?: TailConsumer[];
}

/**
 * The environment configuration properties that have been deprecated.
 */
interface EnvironmentDeprecated {
  /**
   * The zone ID of the zone you want to deploy to. You can find this
   * in your domain page on the dashboard.
   *
   * @deprecated This is unnecessary since we can deduce this from routes directly.
   */
  zone_id?: string;

  /**
   * Legacy way of defining KVNamespaces that is no longer supported.
   *
   * @deprecated DO NOT USE. This was a legacy bug from Wrangler v1, that we do not want to support.
   */
  "kv-namespaces"?: string;

  /**
   * A list of services that your worker should be bound to.
   *
   * @default `[]`
   * @deprecated DO NOT USE. We'd added this to test the new service binding system, but the proper way to test experimental features is to use `unsafe.bindings` configuration.
   */
  experimental_services?: {
    /** The binding name used to refer to the Service */
    name: string;
    /** The name of the Service being bound */
    service: string;
    /** The Service's environment */
    environment: string;
  }[];
}

/**
 * Deprecated upload configuration.
 */
export interface DeprecatedUpload {
  /**
   * The format of the Worker script.
   *
   * @deprecated We infer the format automatically now.
   */
  format?: "modules" | "service-worker";

  /**
   * The directory you wish to upload your worker from,
   * relative to the wrangler.toml file.
   *
   * Defaults to the directory containing the wrangler.toml file.
   *
   * @deprecated
   */
  dir?: string;

  /**
   * The path to the Worker script, relative to `upload.dir`.
   *
   * @deprecated This will be replaced by a command line argument.
   */
  main?: string;

  /**
   * @deprecated This is now defined at the top level `rules` field.
   */
  rules?: Environment["rules"];
}

/**
 * The raw environment configuration that we read from the config file.
 *
 * All the properties are optional, and will be replaced with defaults in the configuration that
 * is used in the rest of the codebase.
 */
export type RawEnvironment = Partial<Environment> & EnvironmentDeprecated;

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
  /** (Optional) The environt of the service. */
  environment?: string;
};

export interface DispatchNamespaceOutbound {
  /** Name of the service handling the outbound requests */
  service: string;
  /** (Optional) Name of the environment handling the outbound requests. */
  environment?: string;
  /** (Optional) List of parameter names, for sending context from your dispatch worker to the outbound handler */
  parameters?: string[];
}

export interface UserLimits {
  /** Maximum allowed CPU time for a worker's invocation in milliseconds */
  cpu_ms: number;
}
