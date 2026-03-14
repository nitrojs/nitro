/**
 * Copyright (c) 2020 Cloudflare, Inc. <wrangler@cloudflare.com>
 * https://github.com/cloudflare/workers-sdk/blob/main/LICENSE-MIT
 * https://github.com/cloudflare/workers-sdk/blob/main/LICENSE-APACHE
 *
 * Source: https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/config/config.ts
 */

import type { Environment, RawEnvironment } from "./environment.ts";
import type { CamelCaseKey } from "./_utils.ts";

/**
 * This is the static type definition for the configuration object.
 *
 * It reflects a normalized and validated version of the configuration that you can write in a Wrangler configuration file,
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
 * - All top level fields in config and environments are optional in the Wrangler configuration file.
 *
 * Legend for the annotations:
 *
 * - `@breaking`: the deprecation/optionality is a breaking change from Wrangler v1.
 * - `@todo`: there's more work to be done (with details attached).
 */
export type Config = ComputedFields & ConfigFields<DevConfig> & PagesConfigFields & Environment;

export type RawConfig = Partial<ConfigFields<RawDevConfig>> &
  PagesConfigFields &
  RawEnvironment &
  DeprecatedConfigFields &
  EnvironmentMap & { $schema?: string };

export interface ComputedFields {
  /** The path to the Wrangler configuration file (if any, and possibly redirected from the user Wrangler configuration) used to create this configuration. */
  configPath: string | undefined;
  /** The path to the user's Wrangler configuration file (if any), which may have been redirected to another file that used to create this configuration. */
  userConfigPath: string | undefined;
  /**
   * The original top level name for the Worker in the raw configuration.
   *
   * When a raw configuration has been flattened to a single environment the worker name may have been replaced or transformed.
   * It can be useful to know what the top-level name was before the flattening.
   */
  topLevelName: string | undefined;
}

export interface ConfigFields<Dev extends RawDevConfig> {
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
         * It must be a path relative to your Wrangler configuration file.
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
   * Old behaviour of serving a folder of static assets with your Worker,
   * without any additional code.
   * This can either be a string, or an object with additional config
   * fields.
   * Will be deprecated in the near future in favor of `assets`.
   */
  legacy_assets:
    | {
        bucket: string;
        include: string[];
        exclude: string[];
        browser_TTL: number | undefined;
        serve_single_page_app: boolean;
      }
    | string
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
   * A map of module aliases. Lets you swap out a module for any others.
   * Corresponds with esbuild's `alias` config
   */
  alias: { [key: string]: string } | undefined;

  /**
   * By default, the Wrangler configuration file is the source of truth for your environment configuration, like a terraform file.
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
interface PagesConfigFields {
  /**
   * The directory of static assets to serve.
   *
   * The presence of this field in a Wrangler configuration file indicates a Pages project,
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

interface DeprecatedConfigFields {
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

// API dev only passes in camel-cased versions of keys, so ensure
// only camel-cased keys are used
export type OnlyCamelCase<T = Record<string, never>> = {
  [key in keyof T as CamelCaseKey<key>]: T[key];
};
